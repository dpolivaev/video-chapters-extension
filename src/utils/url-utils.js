/**
 * URL Utilities for Video Chapters Generator
 * 
 * Copyright (C) 2025 Dimitry Polivaev
 * 
 * This file is part of Video Chapters Generator.
 * 
 * Video Chapters Generator is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * Video Chapters Generator is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with Video Chapters Generator. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Removes timestamp parameter 't' from URLs
 * @param {string} url - The URL to clean
 * @returns {string} - The cleaned URL
 */
function cleanVideoURL(url) {
  if (!url || typeof url !== 'string') return url;
  
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.delete('t');
    return urlObj.toString();
  } catch (e) {
    return url;
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cleanVideoURL };
} else if (typeof window !== 'undefined') {
  window.cleanVideoURL = cleanVideoURL;
}