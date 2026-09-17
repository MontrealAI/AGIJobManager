# Decoder compatibility adapter

The `index.js`, `index.d.ts` and `license` files are unmodified from decode-uri-component 0.5.0, which replaces the vulnerable recursive decoder with bounded UTF-8 scanning. The package is MIT licensed.

Older wallet SDK dependencies call this package through CommonJS. `index.cjs` only exposes the upstream default export through that interface; the decoding algorithm is unchanged. Node 22.23.2 is required and browser bundles are qualified in UI CI.

Source: https://www.npmjs.com/package/decode-uri-component/v/0.5.0

Upstream npm archive integrity: `sha512-1BiQVoK8C9gUbQU6NzAtO/tkz2qOFpEObMWpcFvhx4fYnj4Oc5yzaJN/LD36ihkVUdXyh5ZekzX+yM+ty/SrPg==`

Upstream index.js SHA-256: `9401353df38f8010ad7035fe8d666bce6a4902bc1cff809afc4ab23fa2e0bdaa`

Remove the override when the wallet dependency chain directly supports the patched upstream ES module.
