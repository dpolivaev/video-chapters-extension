if (typeof browser === 'undefined') {
  var browser = chrome;
}

document.getElementById('save').onclick = async function() {
  try {
    const apiKey = document.getElementById('apiKey').value;
    await browser.storage.sync.set({ apiKey });
    
    const status = document.getElementById('status');
    status.textContent = 'API Key saved!';
    setTimeout(() => { status.textContent = ''; }, 2000);
  } catch (error) {
    console.error('Error saving API key:', error);
    const status = document.getElementById('status');
    status.textContent = 'Error saving API key!';
    setTimeout(() => { status.textContent = ''; }, 2000);
  }
};

window.onload = async function() {
  try {
    const data = await browser.storage.sync.get('apiKey');
    if (data.apiKey) {
      document.getElementById('apiKey').value = data.apiKey;
    }
  } catch (error) {
    console.error('Error loading API key:', error);
  }
}; 