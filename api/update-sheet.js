// api/update-sheet.js
const { google } = require('googleapis');
const admin = require('firebase-admin');

// Initialize Firebase Admin (same as in vote.js)
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.GCS_PROJECT_ID,
      privateKey: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.GCS_CLIENT_EMAIL,
    }),
  });
} catch (error) {
  if (!/already exists/u.test(error.message)) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  // Secure this endpoint with a secret to prevent public access
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    // 1. Authenticate with Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GCS_CLIENT_EMAIL,
        private_key: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    // 2. Fetch all nominees from Firestore
    const snapshot = await db.collection('nominees').get();
    const nominees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3. Prepare the data row
    const timestamp = new Date().toISOString();
    const headers = ['Timestamp'];
    const values = [timestamp];

    nominees.sort((a,b) => a.name.localeCompare(b.name)); // Sort alphabetically for consistent column order
    nominees.forEach(nominee => {
      headers.push(nominee.name);
      values.push(nominee.votes);
    });

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = 'Sheet1!A1'; // The sheet name

    // 4. Check if headers exist, if not, add them
    const headerCheck = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Sheet1!1:1' });
    if (!headerCheck.data.values || headerCheck.data.values.length === 0) {
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Sheet1!A1',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [headers] },
        });
    }

    // 5. Append the new vote counts
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:A', // Append to the first empty row
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [values],
      },
    });

    res.status(200).json({ success: true, message: 'Sheet updated successfully.' });
  } catch (error) {
    console.error('Error updating sheet:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}