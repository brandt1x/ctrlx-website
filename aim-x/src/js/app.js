/**
 * AIM-X App - Tab routing and Start button (GUI only)
 */
document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      if (!tabId) return; // Skip simulate button

      tabBtns.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const target = document.getElementById(`tab-${tabId}`);
      if (target) target.classList.add('active');
    });
  });

  // Start button (visual toggle only)
  const simulateBtn = document.getElementById('simulateBtn');
  if (simulateBtn) {
    simulateBtn.addEventListener('click', () => {
      const isActive = simulateBtn.classList.contains('active');
      if (isActive) {
        simulateBtn.classList.remove('active');
        simulateBtn.querySelector('.simulate-label').textContent = 'Start';
      } else {
        simulateBtn.classList.add('active');
        simulateBtn.querySelector('.simulate-label').textContent = 'Running';
      }
    });
  }

  // Spinner buttons
  document.querySelectorAll('.spinner-up').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.closest('.spinner-input')?.querySelector('input');
      if (input) {
        const step = parseFloat(input.step) || 1;
        const max = parseFloat(input.max) || Infinity;
        const val = parseFloat(input.value) || 0;
        input.value = Math.min(val + step, max);
      }
    });
  });

  document.querySelectorAll('.spinner-down').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.closest('.spinner-input')?.querySelector('input');
      if (input) {
        const step = parseFloat(input.step) || 1;
        const min = parseFloat(input.min) || -Infinity;
        const val = parseFloat(input.value) || 0;
        input.value = Math.max(val - step, min);
      }
    });
  });
});
