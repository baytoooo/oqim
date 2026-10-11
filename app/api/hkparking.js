// Live vacancy of Hong Kong car parks for private cars (Transport Department, DATA.GOV.HK), passed
// through with CORS for the city page; the upstream API sends no CORS headers.

export default async function handler(req, res) {
  const r = await fetch("https://api.data.gov.hk/v1/carpark-info-vacancy?data=vacancy&vehicleTypes=privateCar&lang=en_US");
  if (!r.ok) {
    res.status(r.status).send("upstream " + r.status);
    return;
  }
  const body = await r.text();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(200).send(body);
}
