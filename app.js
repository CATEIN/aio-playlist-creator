// Global variables
let episodes = [];
let playlistEpisodes = [];
let undoStack = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  loadEpisodes();
  setupEventListeners();
});

// Load episodes from GitHub Gist
async function loadEpisodes() {
  const localUrl = './episodes/episode_names.txt';
  const remoteUrl = 'https://raw.githubusercontent.com/CATEIN/aio-playlist-creator/refs/heads/main/episodes/episode_names.txt';
  try {
    // First try to load from local episodes folder
    console.log("Attempting to load episodes from local folder...");
    let response = await fetch(localUrl);
    
    if (!response.ok) {
      // If local file fails, try remote URL
      console.log("Local file not found, trying remote URL...");
      response = await fetch(remoteUrl);
      
      if (!response.ok) {
        throw new Error('Failed to load episode mapping file from both local and remote sources');
      }
    }
    const text = await response.text();
    const lines = text.split('\n');
    episodes = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        const shortId = parts[0];
        const fullId = parts[1];
        const name = parts.slice(2).join(' ');
        return { shortId, id: fullId, name };
      }
      return null;
    }).filter(ep => ep !== null);
    
    updateSearchPlaceholder();
    console.log("Loaded episodes:", episodes);
    loadFromURL();
  } catch (error) {
    console.error("Error loading episodes:", error);
  }
}

function loadFromURL() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('n');
  const image = params.get('i');
  const encodedEpisodes = params.get('e');

  if (!encodedEpisodes) return;

  // Set name and image if present
  if (name) {
    document.getElementById('playlistName').value = name;
  }
  if (image) {
    document.getElementById('playlistImageURL').value = image;
  }

  // Build shortId -> fullId map
  const shortIdMap = {};
  episodes.forEach(ep => {
    if (ep.shortId) {
      shortIdMap[ep.shortId] = ep.id;
    }
  });

  // Decode episode list
  playlistEpisodes = encodedEpisodes.split('.').map(part => {
    return shortIdMap[part] ?? (part.startsWith('a3') ? part : null);
  });

  // Add unknown episodes to master list if needed
  playlistEpisodes.forEach(id => {
    if (!episodes.find(ep => ep.id === id)) {
      episodes.push({ id, name: 'Unknown Episode' });
    }
  });

  updateSelectedEpisodesDisplay();
  updatePlaylistPreview();
}

// Update search placeholder with the highest episode number
function updateSearchPlaceholder() {
  let maxEpisodeNumber = 0;
  
  episodes.forEach(episode => {
    const match = episode.name.match(/#(\d+):/);
    if (match) {
      const episodeNumber = parseInt(match[1]);
      if (episodeNumber > maxEpisodeNumber) {
        maxEpisodeNumber = episodeNumber;
      }
    }
  });
  
  const searchInput = document.getElementById('searchInput');
  if (searchInput && maxEpisodeNumber > 0) {
    searchInput.placeholder = `Search for episodes (up to #${maxEpisodeNumber}) or paste an episode link`;
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Search functionality
  document.getElementById('searchInput').addEventListener('input', handleSearchInput);
  
  // Playlist management
  document.getElementById('playlistName').addEventListener('input', updatePlaylistPreview);
  document.getElementById('playlistImageURL').addEventListener('input', updatePlaylistPreview);
  document.getElementById('previewCopyBtn').addEventListener('click', copyPlaylist);
  document.getElementById('previewDownloadBtn').addEventListener('click', downloadPlaylist);
  document.getElementById('copyNamesBtn').addEventListener('click', copyEpisodeNames);
  document.getElementById('copyInlineLinksBtn').addEventListener('click', copyInlineLinks);
  document.getElementById('copyUrlsBtn').addEventListener('click', copyLinks);
  document.getElementById('copyIdsBtn').addEventListener('click', copyEpisodeIds);
  document.getElementById('sortAscBtn').addEventListener('click', () => {
    sortPlaylist(true);
  });
  document.getElementById('sortDescBtn').addEventListener('click', () => {
    sortPlaylist(false);
  });
  document.getElementById('modifyPlaylistButton').addEventListener('click', () => {
    document.getElementById('modifyFile').click();
  });
  document.getElementById('modifyFile').addEventListener('change', handleFileImport);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      const url = buildPlaylistURL(true);
      window.location.href = url;
    }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      downloadPlaylist();
    }
  });

  let saveHoldTimeout = null;
  let saveHoldTriggered = false;
  
  let shareHoldTimeout = null;
  let shareHoldTriggered = false;
  
  // Save State – short press: navigate
  document.getElementById('saveStateBtn').addEventListener('click', () => {
    if (saveHoldTriggered) return;
    const url = buildPlaylistURL(true);
    window.location.href = url;
  });
  
  // Save State – long press: confirm and reload
  document.getElementById('saveStateBtn').addEventListener('mousedown', () => {
    saveHoldTriggered = false;
    saveHoldTimeout = setTimeout(() => {
      saveHoldTriggered = true;
      if (confirm("Clear list?")) {
        window.location.href = window.location.pathname;
      }
    }, 1000);
  });
  document.getElementById('saveStateBtn').addEventListener('mouseup', () => {
    clearTimeout(saveHoldTimeout);
  });
  document.getElementById('saveStateBtn').addEventListener('mouseleave', () => {
    clearTimeout(saveHoldTimeout);
  });
  
  // Share – short press: copy short ID URL
  document.getElementById('shareBtn').addEventListener('click', () => {
    if (shareHoldTriggered) return;
    const url = window.location.origin + window.location.pathname + buildPlaylistURL(true);
    navigator.clipboard.writeText(url)
      .then(() => showPopup('Share link copied!'))
      .catch(() => showPopup('Failed to copy!'));
  });
  
  // Share – long press: copy full ID URL
  document.getElementById('shareBtn').addEventListener('mousedown', () => {
    shareHoldTriggered = false;
    shareHoldTimeout = setTimeout(() => {
      shareHoldTriggered = true;
      const url = window.location.origin + window.location.pathname + buildPlaylistURL(false);
      navigator.clipboard.writeText(url)
        .then(() => showPopup('Full-ID link copied!'))
        .catch(() => showPopup('Failed to copy!'));
    }, 1000);
  });
  document.getElementById('shareBtn').addEventListener('mouseup', () => {
    clearTimeout(shareHoldTimeout);
  });
  document.getElementById('shareBtn').addEventListener('mouseleave', () => {
    clearTimeout(shareHoldTimeout);
  });
  
  // Image URL validation
  document.getElementById('playlistImageURL').addEventListener('blur', validateImageURL);
  
  // Global event listeners
  document.addEventListener('paste', handleGlobalPaste);
  document.addEventListener('keydown', handleGlobalKeydown);
  document.addEventListener('dragover', handleDragOver);
  document.addEventListener('drop', handleFileDrop);
}

// Search and episode management functions
function handleSearchInput(e) {
  const query = e.target.value.trim();
  const urlPrefix = "https://app.adventuresinodyssey.com/content/";
  
  if (query.startsWith(urlPrefix)) {
    const episodeId = query.slice(urlPrefix.length).split(/[/?\s]/)[0];
    if (playlistEpisodes.includes(episodeId)) {
      if (!confirm("You have already added this episode to the playlist. Are you sure you want to add it again?")) {
        e.target.value = "";
        return;
      }
    }
    playlistEpisodes.push(episodeId);
    if (!episodes.find(ep => ep.id === episodeId)) {
      episodes.push({ id: episodeId, name: "Unknown Episode" });
    }
    updateSelectedEpisodesDisplay();
    e.target.value = "";
    document.getElementById('resultsContainer').innerHTML = "";
    return;
  }
  
  const matches = findMatches(query);
  displayResults(matches);
}

function findMatches(query) {
  query = query.toLowerCase().trim();
  if (!query) return [];
  let matches = episodes.filter(ep => ep.name.toLowerCase().includes(query));
  matches.sort((a, b) => a.name.toLowerCase().indexOf(query) - b.name.toLowerCase().indexOf(query));
  return matches.slice(0, 15);
}

function displayResults(matchList) {
  const container = document.getElementById('resultsContainer');
  container.innerHTML = '';
  
  if (matchList.length === 0) {
    container.innerHTML = '<p>No matching episode found.</p>';
    return;
  }
  
  matchList.forEach(episode => {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'result';
    
    const episodeLink = document.createElement('a');
    episodeLink.href = `https://app.adventuresinodyssey.com/content/${episode.id}`;
    episodeLink.target = '_blank';
    episodeLink.textContent = episode.name;
    resultDiv.appendChild(episodeLink);
    
    const addButton = document.createElement('button');
  addButton.className = 'add-btn';
  addButton.textContent = '+';
  addButton.title = 'Add to playlist';
  addButton.addEventListener('click', () => {
  if (playlistEpisodes.includes(episode.id)) {
    if (!confirm("You have already added this episode to the playlist. Are you sure you want to add it again?")) {
      return;
    }
  }
  playlistEpisodes.push(episode.id);
  updateSelectedEpisodesDisplay();
});
resultDiv.appendChild(addButton);
    
    container.appendChild(resultDiv);
  });
}

// Playlist display and management
function updateSelectedEpisodesDisplay() {
  const container = document.getElementById('selectedEpisodesContainer');
  container.innerHTML = '';

  if (playlistEpisodes.length === 0) {
    container.style.display = 'none';
  } else {
    container.style.display = 'block';
  }
  
  playlistEpisodes.forEach((epId, index) => {
    const episode = episodes.find(ep => ep.id === epId);
    const displayName = episode ? episode.name : epId;
    
    const div = document.createElement('div');
    div.className = 'selected-episode';
    div.draggable = true;
    div.dataset.index = index;

    setupDragAndDrop(div, index);

    // ➕ Create left-side arrow group
    const moveGroup = document.createElement('div');
    moveGroup.className = 'move-group';

    const upBtn = document.createElement('button');
    upBtn.textContent = ' ↑  ';
    upBtn.title = 'Move up';
    upBtn.addEventListener('click', () => {
      if (index > 0) {
        [playlistEpisodes[index - 1], playlistEpisodes[index]] = [playlistEpisodes[index], playlistEpisodes[index - 1]];
        updateSelectedEpisodesDisplay();
      }
    });

    const downBtn = document.createElement('button');
    downBtn.textContent = ' ↓ ';
    downBtn.title = 'Move down';
    downBtn.addEventListener('click', () => {
      if (index < playlistEpisodes.length - 1) {
        [playlistEpisodes[index], playlistEpisodes[index + 1]] = [playlistEpisodes[index + 1], playlistEpisodes[index]];
        updateSelectedEpisodesDisplay();
      }
    });

    moveGroup.appendChild(upBtn);
    moveGroup.appendChild(downBtn);
    div.appendChild(moveGroup);

    // ➕ Episode name/link
    const episodeContainer = document.createElement('div');
    episodeContainer.className = 'episode-name';

    const episodeLink = document.createElement('a');
    episodeLink.href = `https://app.adventuresinodyssey.com/content/${epId}`;
    episodeLink.target = '_blank';
    episodeLink.textContent = displayName;
    episodeLink.style.textDecoration = 'none';

    episodeContainer.appendChild(episodeLink);
    div.appendChild(episodeContainer);

    // ➕ Right-side buttons (copy name, URL, remove)
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'button-group';

    const copyNameBtn = document.createElement('button');
    copyNameBtn.textContent = 'Copy Name';
    copyNameBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(displayName)
        .then(() => showPopup('Episode name copied!'))
        .catch(() => showPopup('Failed to copy name!'));
    });
    buttonGroup.appendChild(copyNameBtn);

    const copyUrlBtn = document.createElement('button');
    copyUrlBtn.textContent = 'Copy URL';
    copyUrlBtn.addEventListener('click', () => {
      const url = `https://app.adventuresinodyssey.com/content/${epId}`;
      navigator.clipboard.writeText(url)
        .then(() => showPopup('Episode URL copied!'))
        .catch(() => showPopup('Failed to copy URL!'));
    });
    buttonGroup.appendChild(copyUrlBtn);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove episode';
    removeBtn.addEventListener('click', () => {
      playlistEpisodes.splice(index, 1);
      updateSelectedEpisodesDisplay();
    });
    buttonGroup.appendChild(removeBtn);

    div.appendChild(buttonGroup);
    container.appendChild(div);
  });

  const header = document.getElementById('selectedEpisodesHeader');
  if (playlistEpisodes.length > 0) {
  header.style.display = 'flex';
  } else {
  header.style.display = 'none';
  }

  const actions = document.getElementById('playlistActions');
  if (playlistEpisodes.length > 0) {
    actions.style.display = 'inline-block';
  } else {
    actions.style.display = 'none';
  }

  updatePlaylistPreview();
  document.getElementById('playlistName').addEventListener('input', updatePlaylistPreview);
  document.getElementById('playlistImageURL').addEventListener('input', updatePlaylistPreview);
}

function updatePlaylistPreview() {
  const name = document.getElementById('playlistName').value.trim();
  const imageURL = document.getElementById('playlistImageURL').value.trim();
  const count = playlistEpisodes.length;

  const preview = document.getElementById('playlistPreview');
  const previewImage = document.getElementById('playlistPreviewImage');
  const previewName = document.getElementById('playlistPreviewName');
  const previewCount = document.getElementById('playlistPreviewCount');

  if (!name && !imageURL && count === 0) {
    preview.style.display = 'none';
    return;
  }

  previewImage.src = imageURL || 'https://via.placeholder.com/120x90?text=No+Image';
  previewName.innerHTML = `<strong>${name || '(Unnamed)'}</strong>`;
  previewCount.textContent = count;
  preview.style.display = 'flex';
}

function setupDragAndDrop(div, index) {
  div.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', index);
    e.dataTransfer.effectAllowed = 'move';
    div.style.opacity = '0.5';
  });
  
  div.addEventListener('dragend', (e) => {
    div.style.opacity = '1';
  });
  
  div.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

  const container = document.getElementById('selectedEpisodesContainer');
  const rect = container.getBoundingClientRect();
  const mouseY = e.clientY;

  const scrollSpeed = 3; // pixels per frame
  const edgeThreshold = 50; // px from top or bottom edge

  if (mouseY - rect.top < edgeThreshold) {
    container.scrollTop -= scrollSpeed;
  } else if (rect.bottom - mouseY < edgeThreshold) {
    container.scrollTop += scrollSpeed;
  }
  });
  
  div.addEventListener('drop', (e) => {
    e.preventDefault();
    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const targetIndex = index;
    if (isNaN(draggedIndex) || draggedIndex === targetIndex) return;
    const [draggedItem] = playlistEpisodes.splice(draggedIndex, 1);
    playlistEpisodes.splice(targetIndex, 0, draggedItem);
    updateSelectedEpisodesDisplay();
  });
}

// Playlist export/import functions
function copyPlaylist() {
  const name = document.getElementById('playlistName').value.trim();
  const imageURL = document.getElementById('playlistImageURL').value.trim();
  let playlistText = '';
  playlistText += `name: "${name}"\n`;
  playlistText += `imageURL: "${imageURL}"\n`;
  const episodeLinks = playlistEpisodes.map(id => `https://app.adventuresinodyssey.com/content/${id}`).join(' ');
  playlistText += episodeLinks;
  
  navigator.clipboard.writeText(playlistText)
    .then(() => showPopup('Playlist data copied!'))
    .catch(err => {
      showPopup('Failed to copy!');
      console.error('Error copying playlist data:', err);
    });
}

function downloadPlaylist() {
  const name = document.getElementById('playlistName').value.trim();
  const imageURL = document.getElementById('playlistImageURL').value.trim();
  const data = {
    metadata: {},
    errors: [],
    contentGroupings: [
      {
        name: name,
        imageURL: imageURL,
        contentList: playlistEpisodes.map(id => ({ id: id }))
      }
    ]
  };
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fileName = name ? name.replace(/\s+/g, '_') + '.aiopl' : 'playlist.aiopl';
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function copyEpisodeNames() {
  if (playlistEpisodes.length === 0) {
    showPopup('No episodes to copy!');
    return;
  }
  
  const names = playlistEpisodes.map(epId => {
    const episode = episodes.find(ep => ep.id === epId);
    return episode ? episode.name : epId;
  }).join('\n\n');
  
  navigator.clipboard.writeText(names)
    .then(() => showPopup('Episode names copied!'))
    .catch(() => showPopup('Failed to copy names!'));
}

function copyInlineLinks() {
  if (playlistEpisodes.length === 0) {
    showPopup('No episodes to copy!');
    return;
  }

  const hyperlinks = playlistEpisodes.map(epId => {
    const episode = episodes.find(ep => ep.id === epId);
    const displayName = episode ? episode.name : epId;
    const url = `https://app.adventuresinodyssey.com/content/${epId}`;
    return `[${displayName}](${url})`;
  }).join('\n\n');

  navigator.clipboard.writeText(hyperlinks)
    .then(() => showPopup('Inline links copied!'))
    .catch(() => showPopup('Failed to copy inline links!'));
}

function copyLinks() {
  if (playlistEpisodes.length === 0) {
    showPopup('No episodes to copy!');
    return;
  }

  const urls = playlistEpisodes.map(epId =>
    `https://app.adventuresinodyssey.com/content/${epId}`
  ).join('\n\n');

  navigator.clipboard.writeText(urls)
    .then(() => showPopup('Episode URLs copied!'))
    .catch(() => showPopup('Failed to copy URLs!'));
}

function copyEpisodeIds() {
  if (playlistEpisodes.length === 0) {
    showPopup('No episodes to copy!');
    return;
  }

  const ids = playlistEpisodes.join('\n\n');

  navigator.clipboard.writeText(ids)
    .then(() => showPopup('Episode IDs copied!'))
    .catch(() => showPopup('Failed to copy IDs!'));
}

function sortPlaylist(ascending = true) {
  const episodeOrder = episodes.map(ep => ep.id);
  playlistEpisodes.sort((a, b) => {
    const indexA = episodeOrder.indexOf(a);
    const indexB = episodeOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return ascending ? indexA - indexB : indexB - indexA;
  });
  updateSelectedEpisodesDisplay();
}

function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (data && data.contentGroupings && data.contentGroupings[0]) {
        importPlaylistData(data.contentGroupings[0]);
        showPopup("Playlist imported successfully!");
      } else {
        alert("Invalid file format.");
      }
    } catch (err) {
      alert("Error reading file: " + err);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function importPlaylistData(grouping) {
  document.getElementById('playlistName').value = grouping.name || "";
  document.getElementById('playlistImageURL').value = grouping.imageURL || "";
  playlistEpisodes = [];
  
  if (grouping.contentList && Array.isArray(grouping.contentList)) {
    grouping.contentList.forEach(item => {
      if (item.id) {
        playlistEpisodes.push(item.id);
        if (!episodes.find(ep => ep.id === item.id)) {
          episodes.push({ id: item.id, name: "Unknown Episode" });
        }
      }
    });
  }
  updateSelectedEpisodesDisplay();
}

// Utility functions
function validateImageURL(e) {
  const url = e.target.value.trim();
  if (!url) return;
  
  const tempImg = new Image();
  tempImg.onload = () => {
    console.log("Image loaded successfully.");
  };
  tempImg.onerror = () => {
    if (!confirm("This image may not display on the club properly. Are you sure you want to use it?")) {
      e.target.value = "";
    }
  };
  tempImg.src = url;
}

function showPopup(message) {
  const popup = document.getElementById('popup');
  popup.textContent = message;
  popup.style.display = 'block';
  setTimeout(() => {
    popup.style.display = 'none';
  }, 2000);
}

function buildPlaylistURL(useShortIds = true) {
  const name = document.getElementById('playlistName').value.trim();
  const image = document.getElementById('playlistImageURL').value.trim();

  const idToShort = {};
  episodes.forEach(ep => {
    if (ep.shortId) {
      idToShort[ep.id] = ep.shortId;
    }
  });

  const episodeList = playlistEpisodes.map(id => {
    return useShortIds && idToShort[id] ? idToShort[id] : id;
  }).join('.');

  const params = new URLSearchParams({
    n: name,
    i: image,
    e: episodeList
  });

  return `?${params.toString()}`;
}

// Global event handlers
function handleGlobalPaste(e) {
  const activeTag = document.activeElement.tagName.toLowerCase();
  if (activeTag === 'input' || activeTag === 'textarea') {
    return;
  }
  
  undoStack.push({
    playlistName: document.getElementById('playlistName').value,
    playlistImageURL: document.getElementById('playlistImageURL').value,
    playlistEpisodes: [...playlistEpisodes]
  });
  
  const pastedText = e.clipboardData.getData('text/plain');
  
  // Check for original playlist format (name: imageURL: episodes)
  if (pastedText.includes('name:') && pastedText.includes('imageURL:')) {
    const lines = pastedText.split('\n').map(l => l.trim()).filter(l => l !== "");
    if (lines.length >= 3) {
      const nameMatch = lines[0].match(/^name:\s*"(.*)"$/);
      const imageMatch = lines[1].match(/^imageURL:\s*"(.*)"$/);
      if (nameMatch && imageMatch) {
        const name = nameMatch[1];
        const imageURL = imageMatch[1];
        const episodesLine = lines.slice(2).join(' ');
        const urlPrefix = "https://app.adventuresinodyssey.com/content/";
        const episodeIDs = episodesLine.split(/\s+/)
          .filter(link => link.startsWith(urlPrefix))
          .map(link => link.slice(urlPrefix.length));
        
        document.getElementById('playlistName').value = name;
        document.getElementById('playlistImageURL').value = imageURL;
        playlistEpisodes = episodeIDs;
        
        episodeIDs.forEach(id => {
          if (!episodes.find(ep => ep.id === id)) {
            episodes.push({ id: id, name: "Unknown Episode" });
          }
        });
        updateSelectedEpisodesDisplay();
        showPopup("Playlist imported from clipboard!");
        return;
      }
    }
  }
  
  // Check for hyperlinks format [Episode Name](URL)
  const hyperlinkPattern = /\[([^\]]+)\]\(https:\/\/app\.adventuresinodyssey\.com\/content\/([^)]+)\)/g;
  const hyperlinkMatches = [...pastedText.matchAll(hyperlinkPattern)];
  if (hyperlinkMatches.length > 0) {
    hyperlinkMatches.forEach(match => {
      const episodeName = match[1];
      const episodeId = match[2];
      
      if (!playlistEpisodes.includes(episodeId)) {
        playlistEpisodes.push(episodeId);
      }
      
      // Update episodes array with the episode name if we don't have it
      const existingEpisode = episodes.find(ep => ep.id === episodeId);
      if (!existingEpisode) {
        episodes.push({ id: episodeId, name: episodeName });
      } else if (existingEpisode.name === "Unknown Episode") {
        existingEpisode.name = episodeName;
      }
    });
    updateSelectedEpisodesDisplay();
    showPopup(`Added ${hyperlinkMatches.length} episodes from hyperlinks!`);
    return;
  }
  
  // Check for episode names format (episode names separated by newlines)
  const episodeNames = pastedText.split('\n').map(name => name.trim()).filter(name => name !== "");
  if (episodeNames.length > 0) {
    let addedCount = 0;
    episodeNames.forEach(episodeName => {
      // Try to find matching episode by exact name match first
      const exactMatch = episodes.find(ep => 
        ep.name.toLowerCase() === episodeName.toLowerCase()
      );
      
      if (exactMatch && !playlistEpisodes.includes(exactMatch.id)) {
        playlistEpisodes.push(exactMatch.id);
        addedCount++;
      }
    });
    
    if (addedCount > 0) {
      updateSelectedEpisodesDisplay();
      showPopup(`Added ${addedCount} episodes from names!`);
      return;
    }
  }
}

function handleGlobalKeydown(e) {
  const activeTag = document.activeElement.tagName.toLowerCase();
  if (activeTag === 'input' || activeTag === 'textarea') return;

  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    if (undoStack.length > 0) {
      const prevState = undoStack.pop();
      document.getElementById('playlistName').value = prevState.playlistName;
      document.getElementById('playlistImageURL').value = prevState.playlistImageURL;
      playlistEpisodes = prevState.playlistEpisodes;
      updateSelectedEpisodesDisplay();
      showPopup("Undo successful!");
      e.preventDefault();
    }
  }
}

function handleDragOver(e) {
  e.preventDefault();
}

function handleFileDrop(e) {
  e.preventDefault();
  if (e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    const allowedExtensions = ['aiopl', 'json', 'txt'];
    const fileName = file.name.toLowerCase();
    const ext = fileName.split('.').pop();
    
    if (!allowedExtensions.includes(ext)) {
      alert("File type not supported. Please drop a .aiopl, .json, or .txt file.");
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data && data.contentGroupings && data.contentGroupings[0]) {
          importPlaylistData(data.contentGroupings[0]);
          showPopup("Playlist imported successfully from file!");
          return;
        }
        alert("Invalid playlist format in file.");
      } catch (err) {
        // Try parsing as plain text format
        const lines = event.target.result.split('\n').map(l => l.trim()).filter(l => l !== "");
        if (lines.length >= 3) {
          const nameMatch = lines[0].match(/^name:\s*"(.*)"$/);
          const imageMatch = lines[1].match(/^imageURL:\s*"(.*)"$/);
          if (nameMatch && imageMatch) {
            const name = nameMatch[1];
            const imageURL = imageMatch[1];
            const episodesLine = lines.slice(2).join(' ');
            const urlPrefix = "https://app.adventuresinodyssey.com/content/";
            const episodeIDs = episodesLine.split(/\s+/)
              .filter(link => link.startsWith(urlPrefix))
              .map(link => link.slice(urlPrefix.length));
            
            document.getElementById('playlistName').value = name;
            document.getElementById('playlistImageURL').value = imageURL;
            playlistEpisodes = episodeIDs;
            
            episodeIDs.forEach(id => {
              if (!episodes.find(ep => ep.id === id)) {
                episodes.push({ id: id, name: "Unknown Episode" });
              }
            });
            updateSelectedEpisodesDisplay();
            showPopup("Playlist imported successfully from file!");
            return;
          }
        }
        alert("Error reading file: " + err);
      }
    };
    reader.readAsText(file);
  }
}