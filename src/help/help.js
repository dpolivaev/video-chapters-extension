/*
  Help Page JavaScript for Video Chapters Generator
  Copyright (C) 2025 Dimitry Polivaev

  This file is part of Video Chapters Generator.

  Video Chapters Generator is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  Video Chapters Generator is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with Video Chapters Generator. If not, see <https://www.gnu.org/licenses/>.
*/

document.addEventListener('DOMContentLoaded', function() {
  initializeHelpPage();
});

function initializeHelpPage() {
  renderExamples();
}

function renderExamples() {
  const examples = getLocalizedMessage('instruction_examples').split('|');

  const container = document.getElementById('examples-container');
  if (!container) {
    console.error('Examples container not found');
    return;
  }

  const list = document.createElement('ul');
  list.className = 'examples-list';

  examples.forEach(example => {
    const li = document.createElement('li');
    li.textContent = example;
    li.addEventListener('click', () => copyToClipboard(example, li));
    list.appendChild(li);
  });

  container.appendChild(list);
}

async function copyToClipboard(text, element) {
  try {
    await navigator.clipboard.writeText(text);
    showCopySuccess(element);
  } catch (error) {
    console.error('Failed to copy text:', error);
    fallbackCopyToClipboard(text, element);
  }
}

function fallbackCopyToClipboard(text, element) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand('copy');
    showCopySuccess(element);
  } catch (error) {
    console.error('Fallback copy failed:', error);
  }

  document.body.removeChild(textArea);
}

function showCopySuccess(element) {
  element.classList.add('copied');
  setTimeout(() => {
    element.classList.remove('copied');
  }, 2000);
}
