# Unified Payment System Guide

Hey guys! I created a reusable payment system so we don't have to copy-paste payment modal code everywhere. Here's how to use it.

---

## How to Use It

### 1. Import the hook

```tsx
import { usePayment } from '../context/PaymentContext';
```

### 2. Call it in your component

```tsx
function MyComponent() {
  const { initiatePayment } = usePayment();

  const handlePayClick = () => {
    initiatePayment({
      amount: 500,
      title: 'Payment Title',
      recipientName: 'John Doe',
      onSuccess: (result) => {
        console.log('Payment done!', result);
        // Call your backend API here to save the payment
      }
    });
  };

  return <button onClick={handlePayClick}>Pay P500</button>;
}
```

The modal pops up automatically. No need to manage modal state yourself.

---

## Options You Can Pass

### Required

- `amount` - The amount in pesos (number)
- `title` - What shows at the top of the modal (string)
- `onSuccess` - Function that runs when payment is done

### Optional

- `recipientName` - Who's receiving the payment
- `description` - Extra info to show
- `requireProof` - Set to `true` if you want to force proof upload
- `allowedMethods` - Array like `['gcash', 'maya']` to limit payment options
- `onCancel` - Function that runs if user cancels

---

## What You Get Back

The `onSuccess` callback gives you a `result` object:

```typescript
{
  method: 'gcash' | 'maya' | 'cash' | 'bank_transfer',
  referenceNumber: 'GCASH-1734123456789-ABC123',  // auto-generated
  proofUrl: 'http://...',  // if they uploaded proof
  paidAt: '2024-12-14T...'  // timestamp
}
```

---

## Real Example (with backend call)

This is how I used it in DirectHiresList:

```tsx
const { initiatePayment } = usePayment();

const handlePayment = (hire) => {
  initiatePayment({
    amount: hire.total_amount,
    title: `Payment for Direct Hire #${hire.hire_id}`,
    recipientName: hire.worker_name,
    description: `Payment for ${hire.packages.map(p => p.name).join(', ')}`,
    onSuccess: async (paymentResult) => {
      // Save to backend
      const response = await fetch(`http://127.0.0.1:8000/direct-hire/${hire.hire_id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          payment_method: paymentResult.method,
          payment_proof_url: paymentResult.proofUrl || null,
          reference_number: paymentResult.referenceNumber
        })
      });

      if (response.ok) {
        // refresh your data, show success message, etc
        loadHires();
      }
    },
    onCancel: () => {
      console.log('User cancelled');
    }
  });
};
```

---

## Limiting Payment Methods

If you only want certain methods:

```tsx
// Cash only
initiatePayment({
  amount: 250,
  title: 'Cash Payment',
  allowedMethods: ['cash'],
  onSuccess: (result) => { ... }
});

// Digital only (no cash)
initiatePayment({
  amount: 1500,
  title: 'Online Payment',
  allowedMethods: ['gcash', 'maya', 'bank_transfer'],
  onSuccess: (result) => { ... }
});
```

---

## What's Already Built In

The payment modal handles:
- Payment method selection (GCash, Maya, Cash, Bank Transfer)
- Processing animation (2 second mock delay)
- Success animation with checkmark
- Auto-generated reference numbers
- Optional proof upload with preview
- Consistent styling that matches our app

---

## Where's the Code

The payment system is at:
```
frontend/src/context/PaymentContext.tsx
```

Already registered in `App.tsx` so you just need to use the hook.

---

## Examples in the Codebase

Check these files if you want to see how it's used:
- `frontend/src/components/DirectHiresList.tsx` - Direct hire payments
- `frontend/src/components/PaymentTrackerOwner.tsx` - Scheduled job payments

---

## Common Issues

**"usePayment must be used within a PaymentProvider"**
- Your component isn't inside the app properly. Should work if you're on a normal page.

**Modal doesn't show up**
- Check your import path is correct: `import { usePayment } from '../context/PaymentContext'`

Hit me up if you have questions!
