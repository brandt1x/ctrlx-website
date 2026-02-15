/**
 * App - Tab routing and Simulate button
 */
document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      tabBtns.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const target = document.getElementById(`tab-${tabId}`);
      if (target) target.classList.add('active');
    });
  });

  // Simulate button
  const simulateBtn = document.getElementById('simulateBtn');
  if (simulateBtn) {
    simulateBtn.addEventListener('click', () => {
      const isActive = Simulator.isActive();
      if (isActive) {
        Simulator.stop();
        simulateBtn.classList.remove('active');
        simulateBtn.querySelector('.simulate-label').textContent = 'Simulate';
      } else {
        Simulator.start();
        simulateBtn.classList.add('active');
        simulateBtn.querySelector('.simulate-label').textContent = 'Simulating...';
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

  // Action buttons (visual feedback only)
  document.getElementById('quitGame')?.addEventListener('click', () => {
    console.log('Quit Game clicked');
  });
  document.getElementById('endGame')?.addEventListener('click', () => {
    console.log('End Game clicked');
  });
});
