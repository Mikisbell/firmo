console.log('Test script starting...');

async function test() {
  console.log('Inside async function');
  
  try {
    const response = await fetch('http://localhost:3002/api/health');
    console.log('Health check response:', response.status);
    const data = await response.json();
    console.log('Health check data:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

test().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
