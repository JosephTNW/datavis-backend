import dotenv from "dotenv";

dotenv.config();

const url = 'https://dashscope-intl.aliyuncs.com/api/v1/apps/32ca75a66c144c5fa9dd2fd10345be1a/completion';

const headers = {
  'Authorization': `Bearer ${process.env.DASHSCOPE_TOKEN}`,
  'Content-Type': 'application/json'
};

const data = {
  input: {
    prompt: "Graph me the cities in Garut's data of baby death 2022"
  },
  parameters: {},
  debug: {}
};

fetch(url, {
  method: 'POST',
  headers: headers,
  body: JSON.stringify(data)
})
.then(response => {
  console.log('Response status:', response.status);
  console.log('Response headers:', response.headers);
  return response.json();
})
.then(result => console.log('Response body:', JSON.stringify(result, null, 2)))
.catch(error => console.error('Error:', error));