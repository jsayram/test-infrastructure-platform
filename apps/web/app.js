const button = document.querySelector('#check-health');
const status = document.querySelector('#api-status');

async function checkHealth() {
  button.disabled = true;
  status.textContent = 'Checking API health...';

  try {
    const response = await fetch('/health', { signal: AbortSignal.timeout(5000) });
    if (!response.ok || (await response.json()).status !== 'ok') {
      throw new Error('Unexpected health response');
    }
    status.textContent = 'API is healthy.';
  } catch {
    status.textContent = 'API health check failed. Try again.';
  } finally {
    button.disabled = false;
  }
}

button.addEventListener('click', checkHealth);
checkHealth();
