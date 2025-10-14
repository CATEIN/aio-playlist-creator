let episodes = [];
let fullIdMap = {};   // shortId → fullId
let episodeData = {}; // id (short or full) → name
let currentOpenDropdown = null;

async function loadEpisodes() {
  const localUrl = '../episodes/episode_names.txt';
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

    // Build the mapping objects
    for (const ep of episodes) {
      fullIdMap[ep.shortId] = ep.id;
      episodeData[ep.shortId] = ep.name;
      episodeData[ep.id] = ep.name;
    }
    
    updateSearchPlaceholder();
    console.log("Loaded episodes:", episodes);
    loadFromURL();
  } catch (error) {
    console.error("Error loading episodes:", error);
  }
}

function getEpisodeName(id) {
  return episodeData[id] || "Unknown Episode";
}

function getFullId(id) {
  // If it's a short ID, get the full ID, otherwise return the ID as-is
  return fullIdMap[id] || id;
}

function formatDate(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) return dateString;
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return dateString;
  }
}

function groupPlaylistsByCategory(playlists) {
  const categories = {};
  playlists.forEach(playlist => {
    if (!categories[playlist.category]) {
      categories[playlist.category] = [];
    }
    categories[playlist.category].push(playlist);
  });
  return categories;
}

function createPlaylistElement(playlist) {
  const container = document.createElement('div');
  container.className = 'playlist-container';

  const img = document.createElement('img');
  img.src = playlist.imageURL || "https://placeholdit.com/120x90/0082c6/ffffff?text=No+image&font=montserrat";
  container.appendChild(img);

  const details = document.createElement('div');
  details.className = 'playlist-details';

  const namePara = document.createElement('p');
  namePara.innerHTML = `<strong>${playlist.name}</strong>`;
  details.appendChild(namePara);

  const createdByPara = document.createElement('p');
  if (playlist.creatorlink) {
    createdByPara.innerHTML = `<bold>Created by:</bold> <span class="creator-link" onclick="window.open('${playlist.creatorlink}', '_blank')">${playlist.createdby}</span>`;
  } else {
    createdByPara.innerHTML = `<bold>Created by:</bold> ${playlist.createdby}`;
  }
  details.appendChild(createdByPara);

  // Add last updated date if available
  if (playlist.lastupdated) {
    const lastUpdatedPara = document.createElement('p');
    const formattedDate = formatDate(playlist.lastupdated);
    lastUpdatedPara.innerHTML = `<bold>Last updated:</bold> ${formattedDate}`;
    lastUpdatedPara.style.fontSize = '0.95em';
    lastUpdatedPara.style.opacity = '0.9';
    details.appendChild(lastUpdatedPara);
  }

  const episodesPara = document.createElement('p');
  episodesPara.style.position = 'relative';

  const viewEpisodesBtn = document.createElement('button');
  viewEpisodesBtn.className = 'copy-button view-episodes-btn';
  viewEpisodesBtn.textContent = 'View Episodes';
  viewEpisodesBtn.style.marginRight = '10px';

  const episodesDropdown = document.createElement('div');
  episodesDropdown.className = 'episodes-dropdown';

  const episodeCount = document.createElement('div');
  episodeCount.className = 'episode-count';
  episodeCount.textContent = `${playlist.episodes.length} Episodes`;
  
  // Add warning image if over 200 episodes
  if (playlist.episodes.length > 200) {
    const warningImg = document.createElement('img');
    warningImg.src = 'https://i.postimg.cc/nhpkBp81/genuinefear.png';
    warningImg.style.width = '20px';
    warningImg.style.height = '20px';
    warningImg.style.marginLeft = '8px';
    warningImg.style.verticalAlign = 'middle';
    warningImg.style.cursor = 'help';
    warningImg.style.border = 'none';
    warningImg.style.borderRadius = '0';
    warningImg.title = 'This playlist contains over 200 episodes, which is the soft limit for the club. Viewing or using this playlist on the club has performance issues.';
    episodeCount.appendChild(warningImg);
  }
  
  episodesDropdown.appendChild(episodeCount);

  playlist.episodes.forEach(id => {
    const fullId = getFullId(id);
    const name = getEpisodeName(id);

    const episodeItem = document.createElement('div');
    episodeItem.className = 'episode-item';

    const episodeLink = document.createElement('a');
    episodeLink.className = 'episode-link';
    episodeLink.href = `https://app.adventuresinodyssey.com/content/${fullId}`;
    episodeLink.target = '_blank';
    episodeLink.textContent = name;

    episodeItem.appendChild(episodeLink);
    episodesDropdown.appendChild(episodeItem);
  });

  viewEpisodesBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (currentOpenDropdown && currentOpenDropdown !== episodesPara) {
      const otherDropdown = currentOpenDropdown.querySelector('.episodes-dropdown');
      const otherButton = currentOpenDropdown.querySelector('.view-episodes-btn');
      if (otherDropdown && otherButton) {
        otherDropdown.classList.remove('show');
        otherButton.textContent = 'View Episodes';
      }
    }
    const isShowing = episodesDropdown.classList.contains('show');
    episodesDropdown.classList.toggle('show');
    viewEpisodesBtn.textContent = isShowing ? 'View Episodes' : 'Hide Episodes';
    currentOpenDropdown = isShowing ? null : episodesPara;
  });

  episodesDropdown.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  episodesPara.appendChild(viewEpisodesBtn);
  episodesPara.appendChild(episodesDropdown);
  details.appendChild(episodesPara);
  container.appendChild(details);

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';

  const buttonRow = document.createElement('div');
  buttonRow.className = 'button-row';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-button';
  copyBtn.textContent = 'Copy List';
  copyBtn.addEventListener('click', () => {
    const playlistText =
      `name: "${playlist.name}"\n` +
      `imageURL: "${playlist.imageURL}"\n` +
      playlist.episodes.map(id => {
        const fullId = getFullId(id);
        return `https://app.adventuresinodyssey.com/content/${fullId}`;
      }).join(' ');
    navigator.clipboard.writeText(playlistText)
      .then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      })
      .catch(err => {
        console.error('Error copying data:', err);
      });
  });
  buttonRow.appendChild(copyBtn);

  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'copy-button';
  downloadBtn.textContent = '.aiopl';
  downloadBtn.addEventListener('click', () => {
    const aioplData = {
      metadata: {},
      errors: [],
      contentGroupings: [
        {
          name: playlist.name,
          imageURL: playlist.imageURL,
          contentList: playlist.episodes.map(id => ({
            id: getFullId(id)
          }))
        }
      ]
    };
    const blob = new Blob([JSON.stringify(aioplData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${playlist.name}.aiopl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  buttonRow.appendChild(downloadBtn);

  buttonGroup.appendChild(buttonRow);

  const openInCreatorBtn = document.createElement('button');
  openInCreatorBtn.className = 'copy-button';
  openInCreatorBtn.textContent = 'Open in Playlist Creator';
  openInCreatorBtn.addEventListener('click', () => {
    const episodeList = playlist.episodes.join('.');
    const params = new URLSearchParams({
      n: playlist.name,
      i: playlist.imageURL,
      e: episodeList
    });
    const url = `https://catein.github.io/aio-playlist-creator/?${params.toString()}`;
    window.open(url, '_blank');
  });
  buttonGroup.appendChild(openInCreatorBtn);

  container.appendChild(buttonGroup);
  return container;
}

function createCategorySection(categoryName, playlists) {
  const section = document.createElement('div');
  section.className = 'category-section';

  const headerDiv = document.createElement('div');
  headerDiv.className = 'category-header';
  headerDiv.onclick = () => toggleCategory(section);

  const toggle = document.createElement('span');
  toggle.className = 'category-toggle';
  toggle.textContent = '▶';
  headerDiv.appendChild(toggle);

  const header = document.createElement('h2');
  header.textContent = categoryName;
  header.style.margin = '0';
  headerDiv.appendChild(header);

  section.appendChild(headerDiv);

  const content = document.createElement('div');
  content.className = 'category-content';

  playlists.forEach(playlist => {
    content.appendChild(createPlaylistElement(playlist));
  });

  section.appendChild(content);
  return section;
}

function toggleCategory(section) {
  const toggle = section.querySelector('.category-toggle');
  const content = section.querySelector('.category-content');

  if (content.classList.contains('show')) {
    content.classList.remove('show');
    toggle.classList.remove('expanded');
  } else {
    content.classList.add('show');
    toggle.classList.add('expanded');
  }
}

async function loadAllPlaylists() {
  await loadEpisodes();
  try {
    const response = await fetch("playlists.json");
    if (!response.ok) throw new Error("Could not load playlist data");

    const playlists = await response.json();
    const categorized = groupPlaylistsByCategory(playlists);
    const container = document.getElementById("playlist-categories");

    const categoryOrder = ['Characters & Arcs', 'Themes', 'Personal Favorites', 'Other'];
    categoryOrder.forEach(category => {
      if (categorized[category]) {
        container.appendChild(createCategorySection(category, categorized[category]));
        delete categorized[category];
      }
    });

    for (const [category, group] of Object.entries(categorized)) {
      container.appendChild(createCategorySection(category, group));
    }

  } catch (err) {
    console.error("Error loading playlists:", err);
  }
}

document.addEventListener('click', function (event) {
  if (currentOpenDropdown && !currentOpenDropdown.contains(event.target)) {
    const dropdown = currentOpenDropdown.querySelector('.episodes-dropdown');
    const button = currentOpenDropdown.querySelector('.view-episodes-btn');
    if (dropdown && button) {
      dropdown.classList.remove('show');
      button.textContent = 'View Episodes';
      currentOpenDropdown = null;
    }
  }
});

function getUrlParameter(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

async function loadSinglePlaylist(playlistId) {
  await loadEpisodes();
  try {
    const response = await fetch("playlists.json");
    if (!response.ok) throw new Error("Could not load playlist data");

    const playlists = await response.json();
    const playlist = playlists.find(p => p.id == playlistId);
    
    if (!playlist) {
      const container = document.getElementById("playlist-categories");
      container.innerHTML = `
        <div class="category-section">
          <h2>Playlist Not Found</h2>
          <p>No playlist found with ID: ${playlistId}</p>
          <p><a href="?" style="color: #f9d71c; text-decoration: underline;">← Back to all playlists</a></p>
        </div>
      `;
      return;
    }

    // Update page title
    document.title = `${playlist.name} - AIO Community Playlists`;
    
    // Update main heading
    const mainHeading = document.querySelector('h1');
    if (mainHeading) {
      mainHeading.innerHTML = `${playlist.name} <a href="?" style="font-size: 0.5em; color: #f9d71c; text-decoration: underline; margin-left: 20px;">← Back to all playlists</a>`;
    }

    const container = document.getElementById("playlist-categories");
    container.appendChild(createPlaylistElement(playlist));

  } catch (err) {
    console.error("Error loading playlist:", err);
    const container = document.getElementById("playlist-categories");
    container.innerHTML = `
      <div class="category-section">
        <h2>Error</h2>
        <p>Failed to load playlist data.</p>
        <p><a href="?" style="color: #f9d71c; text-decoration: underline;">← Back to all playlists</a></p>
      </div>
    `;
  }
}

async function loadPlaylistsByCreator(creatorName) {
  await loadEpisodes();
  try {
    const response = await fetch("playlists.json");
    if (!response.ok) throw new Error("Could not load playlist data");

    const playlists = await response.json();
    const creatorPlaylists = playlists.filter(p => 
      p.createdby && p.createdby.toLowerCase() === creatorName.toLowerCase()
    );
    
    if (creatorPlaylists.length === 0) {
      const container = document.getElementById("playlist-categories");
      container.innerHTML = `
        <div class="category-section">
          <h2>Creator Not Found</h2>
          <p>No playlists found by creator: ${creatorName}</p>
          <p><a href="?" style="color: #f9d71c; text-decoration: underline;">← Back to all playlists</a></p>
        </div>
      `;
      return;
    }

    // Update page title
    document.title = `${creatorName}'s Playlists - AIO Community Playlists`;
    
    // Update main heading
    const mainHeading = document.querySelector('h1');
    if (mainHeading) {
      mainHeading.innerHTML = `${creatorName}'s Playlists <a href="?" style="font-size: 0.5em; color: #f9d71c; text-decoration: underline; margin-left: 20px;">← Back to all playlists</a>`;
    }

    const container = document.getElementById("playlist-categories");
    
    // Group by category for this creator
    const categorized = groupPlaylistsByCategory(creatorPlaylists);
    
    const categoryOrder = ['Characters & Arcs', 'Themes', 'Personal Favorites', 'Other'];
    categoryOrder.forEach(category => {
      if (categorized[category]) {
        container.appendChild(createCategorySection(category, categorized[category]));
        delete categorized[category];
      }
    });

    // Add any remaining categories
    for (const [category, group] of Object.entries(categorized)) {
      container.appendChild(createCategorySection(category, group));
    }

    // Add creator info at the top
    const creatorInfo = document.createElement('div');
    creatorInfo.style.textAlign = 'center';
    creatorInfo.style.marginBottom = '30px';
    creatorInfo.style.padding = '20px';
    creatorInfo.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    creatorInfo.style.borderRadius = '10px';
    creatorInfo.innerHTML = `
      <p style="font-size: 1.2em; margin: 0;">
        Showing ${creatorPlaylists.length} playlist${creatorPlaylists.length !== 1 ? 's' : ''} by <strong>${creatorName}</strong>
      </p>
    `;
    container.insertBefore(creatorInfo, container.firstChild);

  } catch (err) {
    console.error("Error loading creator playlists:", err);
    const container = document.getElementById("playlist-categories");
    container.innerHTML = `
      <div class="category-section">
        <h2>Error</h2>
        <p>Failed to load playlist data.</p>
        <p><a href="?" style="color: #f9d71c; text-decoration: underline;">← Back to all playlists</a></p>
      </div>
    `;
  }
}

function initializePage() {
  const playlistId = getUrlParameter('playlist');
  const creatorName = getUrlParameter('creator');
  
  if (playlistId) {
    loadSinglePlaylist(playlistId);
  } else if (creatorName) {
    loadPlaylistsByCreator(creatorName);
  } else {
    loadAllPlaylists();
  }
}

// Initialize the page
initializePage();