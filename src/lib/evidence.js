// Evidence preparation shared by every jury flow (single-leg + legs,
// assess + appeal resolve): downscale the photo client-side, upload a
// viewable copy to Catbox (with manual-URL fallback), and derive both the
// hex calldata and the SHA-256 the contract committed at submit time.

import { downscaleImage, uploadToCatbox, blobToHex } from "./upload.js";

export async function prepareEvidence(file, urlFallback) {
  const small = await downscaleImage(file);
  let url = "";
  try {
    url = await uploadToCatbox(small);
  } catch (e) {
    if (urlFallback && String(urlFallback).trim().startsWith("http")) {
      url = String(urlFallback).trim();
    } else {
      throw e;
    }
  }
  const hex = await blobToHex(small);
  const digest = await crypto.subtle.digest("SHA-256", await small.arrayBuffer());
  const sha256 = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { url, hex, sha256 };
}

/** Guard a resolve-* call: the re-selected bytes must hash to the committed evidence. */
export function hashMatches(sha256, committed) {
  return String(sha256).toLowerCase() === String(committed || "").toLowerCase();
}
