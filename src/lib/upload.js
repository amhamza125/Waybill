// Photo handling for delivery evidence.
// The jury needs raw image bytes (passed as a hex `bytes` arg to the
// contract), while humans want a viewable URL. This module does both:
// downscale client-side to keep calldata small, upload to catbox.moe for
// display, and hex-encode the bytes for the contract call.

export async function downscaleImage(file, maxDim = 800, quality = 0.7) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (bitmap.close) bitmap.close();
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) throw new Error("Could not process the image.");
  return blob;
}

export async function uploadToCatbox(blob, filename = "evidence.jpg") {
  const fd = new FormData();
  fd.append("reqtype", "fileupload");
  fd.append("fileToUpload", blob, filename);
  const res = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: fd,
  });
  const text = (await res.text()).trim();
  if (!res.ok || !text.startsWith("http")) {
    throw new Error(
      "Photo upload failed — paste an image URL directly instead."
    );
  }
  return text;
}

export async function blobToHex(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let hex = "0x";
  for (let i = 0; i < buf.length; i++) {
    hex += buf[i].toString(16).padStart(2, "0");
  }
  return hex;
}
