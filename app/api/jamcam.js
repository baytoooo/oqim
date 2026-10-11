// The latest image or 10-second clip of one TfL JamCam (Transport for London open data), passed
// through so the page can read its pixels: TfL's bucket sends no CORS headers, and the site is
// cross-origin isolated. Only JamCam ids are accepted. Powered by TfL Open Data.

const ID = /^\d{5}\.\d{5}$/;

export default async function handler(req, res) {
  const id = String(req.query.id || "");
  const kind = req.query.kind === "jpg" ? "jpg" : "mp4";
  if (!ID.test(id)) {
    res.status(400).send("bad id");
    return;
  }
  const r = await fetch(`https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/${id}.${kind}`);
  if (!r.ok) {
    res.status(r.status).send("upstream " + r.status);
    return;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  res.setHeader("Content-Type", kind === "jpg" ? "image/jpeg" : "video/mp4");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "public, max-age=60");
  const lm = r.headers.get("last-modified");
  if (lm) res.setHeader("Last-Modified", lm);
  res.status(200).send(buf);
}
