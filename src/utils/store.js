import { Capacitor } from '@capacitor/core';

let storeInitialized = false;

export const initStore = (onPurchaseSuccess) => {
  if (!Capacitor.isNativePlatform() || storeInitialized) return;

  if (typeof window.CdvPurchase === 'undefined') {
    console.log('Store not available on this platform.');
    return;
  }

  const { store, ProductType, Platform } = window.CdvPurchase;

  // Handle debug logs
  store.verbosity = store.DEBUG;

  // Register products
  store.register([{
    id: 'standard_pass.',
    type: ProductType.PAID_SUBSCRIPTION,
    platform: Platform.GOOGLE_PLAY,
  }, {
    id: 'elite_pass',
    type: ProductType.PAID_SUBSCRIPTION,
    platform: Platform.GOOGLE_PLAY,
  }]);

  // Error handling
  store.error((error) => {
    console.error('Store Error ' + error.code + ': ' + error.message);
  });

  // Listen for product updates
  store.when().updated((product) => {
    console.log('Product updated:', product.id, product.state);
  });

  // Approved -> Verified -> Finished flow
  store.when()
    .approved((transaction) => {
      console.log('Transaction approved, verifying...', transaction.id);
      transaction.verify();
    })
    .verified((receipt) => {
      console.log('Receipt verified, finishing...', receipt.id);
      receipt.finish();
    })
    .finished((transaction) => {
      console.log('Transaction finished:', transaction.id);
      const productId = transaction.products[0]?.id;
      if (productId) {
        onPurchaseSuccess(productId);
      }
    });

  store.initialize([Platform.GOOGLE_PLAY])
    .then(() => {
      console.log('Store initialized successfully');
      storeInitialized = true;
    })
    .catch((err) => {
      console.error('Store initialization failed:', err);
    });
};

export const requestPurchase = (productId) => {
  if (!window.CdvPurchase) return;
  const { store } = window.CdvPurchase;

  const product = store.get(productId);
  if (product && product.canPurchase) {
    const offer = product.getOffer();
    if (offer) {
      offer.order();
    } else {
      alert('No active offer found for this product.');
    }
  } else {
    alert('Product not found or not available for purchase.');
  }
};
