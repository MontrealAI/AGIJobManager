# AsyncStorage browser adapter

The files inventoried in `UPSTREAM_SHA256.json` are copied byte-for-byte from the official `@react-native-async-storage/async-storage` 2.2.0 npm archive. The MIT license is retained. The local package metadata selects its published browser implementation and its exact `merge-options` dependency; it does not copy the native platform entry or require React Native.

Source: https://github.com/react-native-async-storage/async-storage/tree/v2.2.0/packages/default-storage-backend

Archive: https://registry.npmjs.org/@react-native-async-storage/async-storage/-/async-storage-2.2.0.tgz

Archive integrity: `sha512-gvRvjR5JAaUZF8tv2Kcq/Gbt3JHwbKFYfmb445rhOj6NUMx3qPLixmDx5pZAyb9at1bYvJ4/eTUipU5aki45xw==`

`next.config.js` maps only the exact AsyncStorage package import to this browser entry. The legacy MetaMask SDK's optional native-storage import is traversed by the web bundler even though the application configures the injected wallet connector. Supplying the real browser implementation resolves that platform mismatch without a missing-module warning or an empty module. If called in a browser, the adapter implements the upstream asynchronous localStorage operations and propagates storage errors. It must not be treated as encrypted storage or used to store signing keys.

The existing SDK expects the legacy default-export API; 2.2.0 supplies that API. AsyncStorage 3 has a different API and is not substituted without a caller migration. Remove this adapter when the compatible wallet SDK chain no longer imports the old package. Tests verify file hashes, storage behavior and error propagation.
