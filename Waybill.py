# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json
import hashlib
# ---------------------------------------------------------------------------
# Waybill v2 -- trustless freight settlement (GenLayer)
# A shipper locks GEN escrow when creating a shipment. On delivery, the
# carrier submits photo evidence; an AI vision jury (validator consensus)
# classifies the damage and the contract releases real GEN payouts:
# INTACT -> carrier 100% | MINOR_DAMAGE -> 85-15 | MAJOR_DAMAGE -> 40-60 |
# TOTAL_LOSS -> shipper refunded 100%.
# Payouts are real EVM value transfers executed at finalization.
#
# v2 changes (steward review):
#  1. assess_delivery is gated to the shipment's shipper or carrier only
#     (ONLY_PARTY_ASSESS) -- outsiders can no longer trigger the jury.
#  2. submit_evidence commits a SHA-256 of the photo bytes; assess_delivery
#     recomputes the hash over the assessed bytes and fails closed on
#     mismatch (EVIDENCE_MISMATCH) -- the jury can only grade the exact
#     bytes that were committed.
#  3. shipments and assessment_history now use TreeMap[str, str] with
#     stringified integer keys (was TreeMap[bigint, str]).
# Deployed on GenLayer StudioNet (chain 61999).
# ---------------------------------------------------------------------------

@gl.evm.contract_interface
class _Recipient:
    class View:
        pass

    class Write:
        pass


_VERDICTS = ("INTACT", "MINOR_DAMAGE", "MAJOR_DAMAGE", "TOTAL_LOSS")
# Carrier share of escrow in basis points per verdict; the rest refunds the shipper.
_CARRIER_BPS = {
    "INTACT": 10000,
    "MINOR_DAMAGE": 8500,
    "MAJOR_DAMAGE": 4000,
    "TOTAL_LOSS": 0,
}
_HEXCHARS = "0123456789abcdef"
_MAX_SHIPMENTS = 5000
_MAX_HISTORY = 200


class Waybill(gl.Contract):
    owner: str
    protocol_paused: bool          # owner-only emergency stop -- never auto-set
    shipment_count: bigint
    shipments: TreeMap[str, str]            # str(shipment id) -> JSON
    party_shipments: TreeMap[str, str]     # address -> JSON list of shipment ids
    assessment_history: TreeMap[str, str]  # str(seq) -> JSON
    activity_count: bigint
    total_assessed: bigint

    def __init__(self):
        # TreeMap fields are NOT assigned here -- GenVM zero-initializes them
        # automatically the moment they're declared.
        self.owner = str(gl.message.sender_address)
        self.protocol_paused = False
        self.shipment_count = 0
        self.activity_count = 0
        self.total_assessed = 0

    # -- internal helpers -------------------------------------------------
    def _load(self, shipment_id: bigint):
        sid = bigint(shipment_id)
        key = str(int(sid))
        if key not in self.shipments:
            raise gl.vm.UserError("SHIPMENT_NOT_FOUND")
        return sid, json.loads(self.shipments[key])

    def _save(self, sid: bigint, data: dict) -> None:
        self.shipments[str(int(sid))] = json.dumps(data)

    def _log(self, payload: dict) -> None:
        self.activity_count += 1
        self.assessment_history[str(int(self.activity_count))] = json.dumps(payload)

    def _index_party(self, addr: str, sid: bigint) -> None:
        if addr in self.party_shipments:
            ids = json.loads(self.party_shipments[addr])
        else:
            ids = []
        if int(sid) not in ids:
            ids.append(int(sid))
        self.party_shipments[addr] = json.dumps(ids)

    def _pay(self, recipient: str, amount: u256) -> None:
        # Real GEN transfer to a wallet; executes at finalization.
        if amount == u256(0):
            return
        _Recipient(Address(recipient)).emit_transfer(value=amount)

    # -- writes -----------------------------------------------------------
    @gl.public.write.payable
    def create_shipment(self, carrier: str, label: str, description: str) -> str:
        escrow = gl.message.value
        if escrow == u256(0):
            raise gl.vm.UserError("ESCROW_REQUIRED: send GEN with create_shipment to fund the escrow")
        if len(carrier) < 8:
            raise gl.vm.UserError("INVALID_CARRIER")
        label = label.strip()
        if not label or len(label) > 64:
            raise gl.vm.UserError("INVALID_LABEL: label must be 1-64 chars")
        if not description.strip():
            raise gl.vm.UserError("INVALID_DESCRIPTION")
        if int(self.shipment_count) >= _MAX_SHIPMENTS:
            raise gl.vm.UserError("SHIPMENT_LIMIT_REACHED")

        sid = self.shipment_count
        shipper = str(gl.message.sender_address)
        data = {
            "id": int(sid),
            "shipper": shipper,
            "carrier": carrier,
            "label": label,
            "description": description.strip(),
            "escrow_wei": str(escrow),
            "status": "CREATED",
            "evidence_url": "",
            "evidence_sha256": "",
            "condition_note": "",
            "verdict": "N/A",
            "confidence": 0,
            "jury_notes": "",
            "carrier_payout_wei": "0",
            "shipper_refund_wei": "0",
        }
        self._save(sid, data)
        self.shipment_count += 1
        self._index_party(shipper, sid)
        self._index_party(carrier, sid)

        self._log({
            "type": "CREATE",
            "shipment_id": int(sid),
            "shipper": shipper,
            "carrier": carrier,
            "label": label,
            "escrow_wei": str(escrow),
            "message": f"SHIPMENT_CREATED: #{int(sid)} '{label}' escrowed {str(escrow)} wei GEN",
        })
        return f"SHIPMENT_CREATED: #{int(sid)} '{label}' escrowed {str(escrow)} wei GEN."

    @gl.public.write
    def cancel_shipment(self, shipment_id: bigint) -> str:
        sid, data = self._load(shipment_id)
        if str(gl.message.sender_address) != data["shipper"]:
            raise gl.vm.UserError("ONLY_SHIPPER: only the shipper can cancel")
        if data["status"] != "CREATED":
            raise gl.vm.UserError("CANNOT_CANCEL: evidence already submitted")
        data["status"] = "CANCELLED"
        self._save(sid, data)
        self._pay(data["shipper"], u256(int(data["escrow_wei"])))
        self._log({
            "type": "CANCEL",
            "shipment_id": int(sid),
            "message": f"SHIPMENT_CANCELLED: #{int(sid)} escrow refunded to shipper",
        })
        return f"SHIPMENT_CANCELLED: #{int(sid)} escrow refunded to shipper."

    @gl.public.write
    def submit_evidence(
        self, shipment_id: bigint, evidence_url: str, condition_note: str,
        evidence_sha256: str,
    ) -> str:
        sid, data = self._load(shipment_id)
        sender = str(gl.message.sender_address)
        if sender != data["carrier"] and sender != data["shipper"]:
            raise gl.vm.UserError("ONLY_PARTY: only the shipper or carrier can submit evidence")
        if data["status"] != "CREATED":
            raise gl.vm.UserError("BAD_STATUS: evidence already submitted for this shipment")
        if not evidence_url.strip():
            raise gl.vm.UserError("EVIDENCE_REQUIRED: provide a photo URL of the delivered goods")
        h = evidence_sha256.strip().lower()
        if len(h) != 64 or any(c not in _HEXCHARS for c in h):
            raise gl.vm.UserError("INVALID_EVIDENCE_HASH: evidence_sha256 must be 64 lowercase hex chars")
        data["evidence_url"] = evidence_url.strip()
        data["evidence_sha256"] = h
        data["condition_note"] = condition_note.strip()
        data["status"] = "IN_REVIEW"
        self._save(sid, data)
        self._log({
            "type": "EVIDENCE",
            "shipment_id": int(sid),
            "evidence_url": data["evidence_url"],
            "evidence_sha256": h,
            "message": f"EVIDENCE_SUBMITTED: #{int(sid)} awaiting AI jury assessment",
        })
        return f"EVIDENCE_SUBMITTED: #{int(sid)} awaiting AI jury assessment."

    @gl.public.write
    def assess_delivery(self, shipment_id: bigint, image_data: bytes) -> str:
        if self.protocol_paused:
            raise gl.vm.UserError("PROTOCOL_PAUSED: owner has engaged the emergency stop")
        sid, data = self._load(shipment_id)
        sender = str(gl.message.sender_address)
        if sender != data["shipper"] and sender != data["carrier"]:
            raise gl.vm.UserError("ONLY_PARTY_ASSESS: only the shipper or carrier can trigger assessment")
        if data["status"] != "IN_REVIEW":
            raise gl.vm.UserError("BAD_STATUS: submit evidence before assessment")
        if len(image_data) == 0:
            raise gl.vm.UserError("EVIDENCE_REQUIRED: image bytes missing")
        # Cryptographic binding: the assessed bytes must hash to the evidence
        # committed at submit_evidence time. Anything else fails closed.
        if hashlib.sha256(bytes(image_data)).hexdigest() != data.get("evidence_sha256", ""):
            raise gl.vm.UserError("EVIDENCE_MISMATCH: image bytes do not match the committed evidence hash")

        escrow = u256(int(data["escrow_wei"]))

        def jury():
            prompt = (
                "You are an expert freight damage inspector examining a delivery photo. "
                f"Shipment '{data['label']}': {data['description']}. "
                f"Carrier note: '{data['condition_note']}'. "
                "Classify the visible damage to the goods and packaging as exactly one of: "
                "INTACT, MINOR_DAMAGE, MAJOR_DAMAGE, TOTAL_LOSS. "
                "If the image is missing, unusable, or shows no shipment, classify as TOTAL_LOSS. "
                'Respond as JSON: {"verdict": "<one of the four>", '
                '"confidence": <0-100>, "notes": "<one short sentence>"}.'
            )
            return gl.nondet.exec_prompt(
                prompt, images=[image_data], response_format="json"
            )

        agreed = gl.eq_principle.prompt_comparative(
            jury,
            principle=(
                "Validators must agree on the categorical damage verdict "
                "(one of INTACT, MINOR_DAMAGE, MAJOR_DAMAGE, TOTAL_LOSS). "
                "Confidence scores and notes may differ between validators."
            ),
        )
        verdict = str(agreed.get("verdict", "")).strip().upper()
        if verdict not in _VERDICTS:
            raise gl.vm.UserError("JURY_FAILURE: verdict not recognized -- state unchanged")
        confidence = int(agreed.get("confidence", 0))
        notes = str(agreed.get("notes", ""))

        bps = _CARRIER_BPS[verdict]
        carrier_amt = escrow * u256(bps) // u256(10000)
        shipper_amt = escrow - carrier_amt

        # Record outcome before emitting transfers (transfers finalize async).
        data["status"] = "RESOLVED"
        data["verdict"] = verdict
        data["confidence"] = confidence
        data["jury_notes"] = notes
        data["carrier_payout_wei"] = str(carrier_amt)
        data["shipper_refund_wei"] = str(shipper_amt)
        self._save(sid, data)
        self.total_assessed += 1

        self._pay(data["carrier"], carrier_amt)
        self._pay(data["shipper"], shipper_amt)

        self._log({
            "type": "ASSESS",
            "seq": int(self.total_assessed),
            "shipment_id": int(sid),
            "verdict": verdict,
            "confidence": confidence,
            "carrier_payout_wei": str(carrier_amt),
            "shipper_refund_wei": str(shipper_amt),
            "message": (
                f"DELIVERY_ASSESSED: #{int(sid)} verdict {verdict} "
                f"(confidence {confidence}%) -- carrier {str(carrier_amt)} wei, "
                f"shipper refund {str(shipper_amt)} wei"
            ),
        })
        return (
            f"DELIVERY_ASSESSED: #{int(sid)} verdict {verdict} "
            f"(confidence {confidence}%) -- carrier {str(carrier_amt)} wei, "
            f"shipper refund {str(shipper_amt)} wei. Payouts finalize on-chain "
            f"after the appeal window."
        )

    @gl.public.write
    def pause_protocol(self) -> str:
        if str(gl.message.sender_address) != self.owner:
            raise gl.vm.UserError("ONLY_OWNER")
        self.protocol_paused = True
        self._log({"type": "PAUSE_PROTOCOL", "message": "PROTOCOL_PAUSED by owner"})
        return "PROTOCOL_PAUSED: emergency stop engaged by owner"

    @gl.public.write
    def resume_protocol(self) -> str:
        if str(gl.message.sender_address) != self.owner:
            raise gl.vm.UserError("ONLY_OWNER")
        self.protocol_paused = False
        self._log({"type": "RESUME_PROTOCOL", "message": "PROTOCOL_RESUMED by owner"})
        return "PROTOCOL_RESUMED: emergency stop disengaged"

    # -- views ------------------------------------------------------------
    @gl.public.view
    def get_shipment(self, shipment_id: bigint) -> str:
        key = str(int(bigint(shipment_id)))
        if key not in self.shipments:
            return "NOT_FOUND"
        return self.shipments[key]

    @gl.public.view
    def get_all_shipments(self) -> str:
        out = []
        for i in range(int(self.shipment_count)):
            out.append(json.loads(self.shipments[str(i)]))
        return json.dumps(out)

    @gl.public.view
    def get_shipments_for_party(self, party: str) -> str:
        if party not in self.party_shipments:
            return "[]"
        out = []
        for sid in json.loads(self.party_shipments[party]):
            out.append(json.loads(self.shipments[str(sid)]))
        return json.dumps(out)

    @gl.public.view
    def get_assessment_history(self, limit: int) -> str:
        if limit <= 0 or limit > _MAX_HISTORY:
            limit = _MAX_HISTORY
        total = int(self.activity_count)
        start = max(1, total - limit + 1)
        out = []
        for i in range(start, total + 1):
            out.append(json.loads(self.assessment_history[str(i)]))
        return json.dumps(out)

    @gl.public.view
    def get_protocol_state(self) -> str:
        return json.dumps({
            "paused": self.protocol_paused,
            "owner": self.owner,
            "shipment_count": str(self.shipment_count),
            "total_assessed": str(self.total_assessed),
            "contract_balance_wei": str(self.balance),
        })
