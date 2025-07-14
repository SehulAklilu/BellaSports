// api/vote.js
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.GCS_PROJECT_ID,
      privateKey: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.GCS_CLIENT_EMAIL,
    }),
  });
} catch (error) {
  /*
   * We skip the "already exists" message which is normal on serverless
   * Functions where instances are reused.
   */
  if (!/already exists/u.test(error.message)) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { nomineeId } = req.body;

  if (!nomineeId) {
    return res.status(400).json({ message: 'Nominee ID is required' });
  }

  try {
    const nomineeRef = db.collection('nominees').doc(nomineeId);

    // Use a Firestore transaction to safely increment the vote count
    // This prevents race conditions during high traffic
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(nomineeRef);
      if (!doc.exists) {
        throw new Error("Nominee not found");
      }
      const newVotes = (doc.data().votes || 0) + 1;
      transaction.update(nomineeRef, { votes: newVotes });
    });

    res.status(200).json({ success: true, message: 'Vote counted!' });
  } catch (error) {
    console.error('Error processing vote:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}