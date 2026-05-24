import { loadStripe } from '@stripe/stripe-js';

// Single shared Stripe instance for the entire app.
// Hardcoded publishable key — no env variables.
// To rotate the key, change this one line.
// Payments go directly to the platform (Digital Media Connect Pro LLC).
// The platform then pays out to drivers via Stripe Connect.
export const stripePromise = loadStripe(
  'pk_live_51Sw4PsFsot92rbYtK5JUI9BAJ5R1dfFdSoU7X6Lfhngi2h7NNpBmvXxI61Q6JkwLk7jsdYdiHVvyUYiEzMi1jArb00zIiqhtN6'
);
