(function () {
  'use strict';

  function setupCopyBibtex() {
    const copyBtn = document.getElementById('copyBibtexBtn');
    const bibtexCode = document.getElementById('bibtexCode');

    if (!copyBtn || !bibtexCode) return;

    copyBtn.addEventListener('click', async () => {
      const bibtexText = bibtexCode.textContent.trim();

      try {
        // Try using the modern Clipboard API
        await navigator.clipboard.writeText(bibtexText);

        // Visual feedback
        copyBtn.classList.add('copied');
        const originalText = copyBtn.querySelector('.copy-text').textContent;
        copyBtn.querySelector('.copy-text').textContent = 'Copied!';

        // Reset after 2 seconds
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.querySelector('.copy-text').textContent = originalText;
        }, 2000);
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = bibtexText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();

        try {
          document.execCommand('copy');
          copyBtn.classList.add('copied');
          const originalText = copyBtn.querySelector('.copy-text').textContent;
          copyBtn.querySelector('.copy-text').textContent = 'Copied!';

          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.querySelector('.copy-text').textContent = originalText;
          }, 2000);
        } catch (err2) {
          console.error('Failed to copy text: ', err2);
          copyBtn.querySelector('.copy-text').textContent = 'Failed to copy';
          setTimeout(() => {
            copyBtn.querySelector('.copy-text').textContent = 'Copy BibTeX';
          }, 2000);
        }

        document.body.removeChild(textArea);
      }
    });
  }

  // Expose to global namespace
  window.MIRO = window.MIRO || {};
  window.MIRO.setupCopyBibtex = setupCopyBibtex;
})();
