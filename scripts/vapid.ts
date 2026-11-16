// Generates the key pair that lets the server send push notifications to your phone and computer.
import webpush from "web-push";
const k = webpush.generateVAPIDKeys();
console.log("Copy these two lines into your .env file (local) or the Render dashboard (production):\n");
console.log(`VAPID_PUBLIC_KEY="${k.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${k.privateKey}"`);
console.log("\nThe private key is a secret: never put it in git. Generate ONE pair and keep it. If you replace it, every device must enable notifications again.");
