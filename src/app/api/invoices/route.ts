import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

const PROJECT_ID = 'proyectoprueba-17be4';
const PARENT_PATH = `projects/${PROJECT_ID}/databases/(default)/documents`;
const COLLECTION_NAME = 'newinvoices';

async function getServiceAccountClient() {
  // This check is important. If the variable is not set, we should not proceed.
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("The GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set.");
  }
  const serviceAccountJson = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const jwtClient = new google.auth.JWT(
    serviceAccountJson.client_email,
    undefined,
    serviceAccountJson.private_key,
    ['https://www.googleapis.com/auth/datastore'],
  );

  await jwtClient.authorize();
  return jwtClient;
}

export async function GET(request: NextRequest) {
  try {
    const jwtClient = await getServiceAccountClient();
    const accessToken = (await jwtClient.getAccessToken())?.token;

    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to get access token' }, { status: 500 });
    }

    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // Correctly construct the URL for runQuery
    const firestoreUrl = `https://firestore.googleapis.com/v1/${PARENT_PATH}:runQuery`;
    
    const query = {
      structuredQuery: {
        from: [{ collectionId: COLLECTION_NAME }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'userId' },
            op: 'EQUAL',
            value: { stringValue: userId }
          }
        },
        orderBy: [{ field: { fieldPath: 'date' }, direction: 'DESCENDING' }]
      }
    };

    const response = await fetch(firestoreUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query) // Send the entire query object
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Firestore API error:', errorData);
        return NextResponse.json({ error: 'Failed to fetch invoices', details: errorData }, { status: response.status });
    }

    const queryResults = await response.json();

    const invoices = queryResults
      .map((item: any) => {
        if (!item.document) return null;
        const doc = item.document;
        const fields = doc.fields;
        const id = doc.name.split('/').pop();
        
        return {
            id: id,
            invoiceId: fields.invoiceId?.stringValue,
            customerName: fields.customerName?.stringValue,
            amount: fields.amount?.doubleValue || fields.amount?.integerValue,
            date: fields.date?.timestampValue,
            status: fields.status?.stringValue,
            userId: fields.userId?.stringValue,
        };
    }).filter((i: any) => i !== null);


    return NextResponse.json(invoices);
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    // Be careful not to expose sensitive error details in production
    const errorMessage = error.message || 'Internal Server Error';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}


export async function POST(request: NextRequest) {
  try {
    const jwtClient = await getServiceAccountClient();
    const accessToken = (await jwtClient.getAccessToken())?.token;

    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to get access token' }, { status: 500 });
    }

    const body = await request.json();
    const { userId, ...invoiceData } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    const firestoreUrl = `https://firestore.googleapis.com/v1/${PARENT_PATH}/${COLLECTION_NAME}`;

    const newDoc = {
        fields: {
            userId: { stringValue: userId },
            invoiceId: { stringValue: invoiceData.invoiceId },
            customerName: { stringValue: invoiceData.customerName },
            amount: { doubleValue: invoiceData.amount },
            date: { timestampValue: new Date(invoiceData.date).toISOString() },
            status: { stringValue: invoiceData.status },
        }
    };

    const response = await fetch(firestoreUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newDoc)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Firestore API error:', errorData);
        return NextResponse.json({ error: 'Failed to save invoice', details: errorData }, { status: response.status });
    }

    const createdDoc = await response.json();
    const id = createdDoc.name.split('/').pop();

    return NextResponse.json({ id: id, ...invoiceData, userId }, { status: 201 });
  } catch (error: any) {
    console.error('Error saving invoice:', error);
    const errorMessage = error.message || 'Internal Server Error';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
