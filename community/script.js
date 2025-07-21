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
  img.src = playlist.imageURL;
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

    const categoryOrder = ['Characters & Arcs', 'Themes/Morals', 'Personal Favorites', 'Other'];
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

// Initialize the page
loadAllPlaylists();