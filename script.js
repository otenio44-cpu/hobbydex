const TMDB_KEY = "8529be64a380a422b3b2e29da7becedb";
const RAWG_KEY = "4f9603d0e7bc4e0db54d342df40364d5";

const GENRES_DB = {
    movies: [{id: 28, name: "Ação"}, {id: 12, name: "Aventura"}, {id: 35, name: "Comédia"}, {id: 18, name: "Drama"}, {id: 27, name: "Terror"}, {id: 878, name: "Ficção"}, {id: 10749, name: "Romance"}, {id: 53, name: "Suspense"}, {id: 16, name: "Animação"}],
    games: [{id: "action", name: "Ação"}, {id: "adventure", name: "Aventura"}, {id: "role-playing-games-rpg", name: "RPG"}, {id: "shooter", name: "Tiro"}, {id: "indie", name: "Indie"}, {id: "strategy", name: "Estratégia"}, {id: "sports", name: "Esportes"}, {id: "racing", name: "Corrida"}],
    books: [{id: "fiction", name: "Ficção"}, {id: "fantasy", name: "Fantasia"}, {id: "mystery", name: "Mistério"}, {id: "romance", name: "Romance"}, {id: "history", name: "História"}, {id: "science", name: "Ciência"}, {id: "technology", name: "Tecnologia"}, {id: "business", name: "Negócios"}, {id: "self-help", name: "Autoajuda"}]
};

const ACHIEVEMENTS = [
    { id: 'first', title: 'Primeiro Passo', icon: 'fa-shoe-prints', check: (items) => items.length >= 1 },
    { id: 'movie_buff', title: 'Cinéfilo', icon: 'fa-film', check: (items) => items.filter(i => i.category === 'filmes' && i.status === 'Finalizado').length >= 5 },
    { id: 'binger', title: 'Maratonista', icon: 'fa-tv', check: (items) => items.filter(i => i.category === 'series' && i.status === 'Finalizado').length >= 3 },
    { id: 'gamer', title: 'Gamer', icon: 'fa-gamepad', check: (items) => items.filter(i => i.category === 'jogos' && i.status === 'Finalizado').length >= 5 },
    { id: 'reader', title: 'Leitor', icon: 'fa-book', check: (items) => items.filter(i => i.category === 'livros' && i.status === 'Finalizado').length >= 3 },
    { id: 'master', title: 'Complecionista', icon: 'fa-crown', check: (items) => items.filter(i => i.status === 'Finalizado').length >= 20 }
];

let items = [];
let myItems = [];
let myCollections = []; 
let currentUser = null;
let currentFilter = 'all';
let currentStatusFilter = 'all';
let isCommunityMode = false;
let currentOracleItem = null;
let currentOracleType = null;
let currentSelectedProviders = [];
let userPreferences = { movies: [], games: [], books: [] };
let currentManageItemId = null; 

// VARIÁVEIS DO TIMER
let focusInterval = null;
let focusSeconds = 0;
let isFocusing = false;
let currentFocusItemId = null;

const statusLabels = {
    filmes: { progress: "Assistindo 🍿", done: "Finalizado 🎬" },
    series: { progress: "Maratonando 📺", done: "Finalizado 🎬" },
    jogos:  { progress: "Jogando 🎮", done: "Platinado 🏆" },
    livros: { progress: "Lendo 📖", done: "Lido 📚" }
};

const colorMap = {
    'film': 'var(--color-film)', 'serie': 'var(--color-serie)', 
    'game': 'var(--color-game)', 'book': 'var(--color-book)'
};

function showToast(msg, type = 'success') {
    const container = document.getElementById("toast-container");
    if(!container) return alert(msg);
    const toast = document.createElement("div"); toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i> ${msg}`;
    container.appendChild(toast); setTimeout(() => toast.remove(), 3000);
}

function toggleSidebar() { document.getElementById("sidebar").classList.toggle("open"); }

async function initApp() {
    renderSkeleton();
    if (!window.fbOps || !window.auth || !window.fbOps.signInWithPopup) { 
        console.log("Aguardando Firebase iniciar...");
        setTimeout(initApp, 300); 
        return; 
    }
    
    document.getElementById("loginBtn").onclick = async () => {
        try {
            await window.fbOps.signInWithPopup(window.auth, window.provider);
        } catch (error) {
            console.error("Erro no login:", error);
            showToast("Erro ao logar: " + error.message, "error");
        }
    };
    
    window.fbOps.onAuthStateChanged(window.auth, async (user) => {
        if (user) {
            currentUser = user;
            document.getElementById("loginBtn").style.display = "none";
            document.getElementById("userInfo").style.display = "flex";
            document.getElementById("userName").innerText = user.displayName.split(" ")[0];
            await loadUserProfile(); 
            await loadItems();
            await loadCollections(); 
            showToast("Login realizado!", "success");
        } else {
            currentUser = null;
            document.getElementById("loginBtn").style.display = "block";
            document.getElementById("userInfo").style.display = "none";
            items = []; myItems = []; myCollections = [];
            render();
            renderCollectionsSidebar();
        }
    });
}

function renderSkeleton() { 
    const list = document.getElementById("list");
    if(list) list.innerHTML = Array(4).fill('<div class="skeleton"></div>').join(''); 
}

async function loadItems() {
    if(!currentUser) return;
    isCommunityMode = false;
    document.querySelector(".stats-grid").style.display = "grid";
    document.querySelector(".dashboard-stats").style.display = "block";
    document.querySelector(".input-section-unified").style.display = "block";
    const q = window.fbOps.query(window.fbOps.collection(window.db, "items"), window.fbOps.where("userId", "==", currentUser.uid));
    const snap = await window.fbOps.getDocs(q);
    items = []; snap.forEach(d => items.push({id: d.id, ...d.data()}));
    myItems = [...items]; 
    render();
}

// --- FUNÇÕES DE COLEÇÕES ---
window.openCollectionModal = () => document.getElementById("collectionModal").style.display = "flex";
window.closeCollectionModal = () => document.getElementById("collectionModal").style.display = "none";
window.selectListColor = (color) => { document.getElementById("collectionColor").value = color; showToast("Cor selecionada!", "success"); };
window.saveCollection = async (e) => {
    e.preventDefault();
    if(!currentUser) return showToast("Faça login.", "error");
    const name = document.getElementById("collectionName").value;
    const colorType = document.getElementById("collectionColor").value;
    try {
        await window.fbOps.addDoc(window.fbOps.collection(window.db, "collections"), { userId: currentUser.uid, title: name, colorType: colorType, createdAt: new Date().toISOString() });
        showToast("Coleção criada!", "success"); closeCollectionModal(); e.target.reset(); await loadCollections(); 
    } catch(err) { showToast("Erro: " + err.message, "error"); }
};
window.loadCollections = async () => {
    if(!currentUser) return;
    try {
        const q = window.fbOps.query(window.fbOps.collection(window.db, "collections"), window.fbOps.where("userId", "==", currentUser.uid));
        const snap = await window.fbOps.getDocs(q);
        myCollections = []; snap.forEach(d => myCollections.push({id: d.id, ...d.data()}));
        renderCollectionsSidebar();
    } catch(e) { console.error("Erro coleções:", e); }
};
function renderCollectionsSidebar() {
    const menu = document.getElementById("customListsMenu"); if(!menu) return; menu.innerHTML = "";
    myCollections.forEach(col => {
        const btn = document.createElement("button"); btn.className = "menu-item";
        if(currentFilter === `list:${col.id}`) btn.classList.add("active");
        const dotColor = colorMap[col.colorType] || 'white';
        btn.innerHTML = `<span class="list-dot" style="background:${dotColor}"></span> ${col.title}`;
        btn.onclick = () => window.filterItems(`list:${col.id}`);
        menu.appendChild(btn);
    });
}
window.openManageLists = (itemId) => {
    if(!currentUser) return; currentManageItemId = itemId;
    const item = items.find(i => i.id === itemId); const itemLists = item.lists || []; 
    document.getElementById("manageItemTitle").innerText = `Organizar: ${item.title}`;
    const container = document.getElementById("checklistContainer"); container.innerHTML = "";
    if(myCollections.length === 0) container.innerHTML = "<p style='font-size:0.8rem; color:gray'>Nenhuma coleção criada.</p>";
    myCollections.forEach(col => {
        const div = document.createElement("label"); div.className = "list-checkbox-row"; const isChecked = itemLists.includes(col.id);
        div.innerHTML = `<input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleItemInList('${col.id}', this.checked)"><span style="color:${colorMap[col.colorType]}">●</span> ${col.title}`;
        container.appendChild(div);
    });
    document.getElementById("manageListsModal").style.display = "flex";
};
window.toggleItemInList = async (listId, isAdding) => {
    if(!currentManageItemId) return;
    const idx = items.findIndex(i => i.id === currentManageItemId); if(idx === -1) return;
    let currentLists = items[idx].lists || [];
    if(isAdding) { if(!currentLists.includes(listId)) currentLists.push(listId); } else { currentLists = currentLists.filter(id => id !== listId); }
    items[idx].lists = currentLists;
    await window.fbOps.updateDoc(window.fbOps.doc(window.db, "items", currentManageItemId), { lists: currentLists });
    if(currentFilter.startsWith("list:")) render();
};

// --- MODO BATALHA ---
window.openBattle = async (targetUid, targetName) => {
    if(!currentUser) return showToast("Faça login para batalhar!", "error");
    document.getElementById("battleModal").style.display = "flex";
    document.getElementById("battleMyName").innerText = currentUser.displayName.split(" ")[0];
    document.getElementById("battleOpName").innerText = targetName;
    document.getElementById("battleStats").innerHTML = "<p style='text-align:center'>Analisando dados...</p>";
    
    const q = window.fbOps.query(window.fbOps.collection(window.db, "items"), window.fbOps.where("userId", "==", targetUid));
    const snap = await window.fbOps.getDocs(q);
    const opItems = []; snap.forEach(d => opItems.push(d.data()));

    const categories = [
        { key: 'filmes', icon: 'fa-film', label: 'Filmes' },
        { key: 'series', icon: 'fa-tv', label: 'Séries' },
        { key: 'jogos', icon: 'fa-gamepad', label: 'Jogos' },
        { key: 'livros', icon: 'fa-book', label: 'Livros' }
    ];

    let totalMy = 0, totalOp = 0;
    let html = "";

    categories.forEach(cat => {
        const countMy = myItems.filter(i => i.category === cat.key && i.status === 'Finalizado').length;
        const countOp = opItems.filter(i => i.category === cat.key && i.status === 'Finalizado').length;
        totalMy += countMy; totalOp += countOp;
        const total = countMy + countOp;
        const pctMy = total > 0 ? (countMy / total) * 100 : 50;
        const pctOp = total > 0 ? (countOp / total) * 100 : 50;

        html += `
        <div class="battle-row">
            <span class="battle-score">${countMy}</span>
            <div class="battle-bar-wrapper"><div class="battle-bar-left" style="width:${pctMy}%"></div></div>
            <div class="battle-category-icon"><i class="fa-solid ${cat.icon}"></i></div>
            <div class="battle-bar-wrapper"><div class="battle-bar-right" style="width:${pctOp}%; background:var(--accent)"></div></div>
            <span class="battle-score">${countOp}</span>
        </div>`;
    });

    document.getElementById("battleStats").innerHTML = html;
    let compat = 0;
    if(totalMy > 0 && totalOp > 0) {
        categories.forEach(cat => {
            const hasMy = myItems.some(i => i.category === cat.key);
            const hasOp = opItems.some(i => i.category === cat.key);
            if(hasMy && hasOp) compat += 25;
        });
    } else { compat = 10; }

    setTimeout(() => {
        document.getElementById("battleCompatFill").style.width = compat + "%";
        document.getElementById("battleCompatText").innerText = compat + "% Compatíveis";
    }, 300);
};
window.closeBattle = () => document.getElementById("battleModal").style.display = "none";

// --- MODO FOCO / TIMER ---
window.toggleFocusTimer = () => {
    if(isFocusing) {
        clearInterval(focusInterval);
        isFocusing = false;
        document.getElementById("btnToggleTimer").innerHTML = '<i class="fa-solid fa-play"></i> Focar';
        document.getElementById("btnToggleTimer").classList.remove("stop");
        document.getElementById("focusSessionInfo").innerText = "Sessão pausada";
        saveFocusSession();
    } else {
        isFocusing = true;
        document.getElementById("btnToggleTimer").innerHTML = '<i class="fa-solid fa-pause"></i> Pausar';
        document.getElementById("btnToggleTimer").classList.add("stop");
        document.getElementById("focusSessionInfo").style.display = "inline";
        document.getElementById("focusSessionInfo").innerText = "Focando...";
        focusInterval = setInterval(() => {
            focusSeconds++;
            const mins = Math.floor(focusSeconds / 60).toString().padStart(2, '0');
            const secs = (focusSeconds % 60).toString().padStart(2, '0');
            document.getElementById("focusTimerDisplay").innerText = `${mins}:${secs}`;
        }, 1000);
    }
};

async function saveFocusSession() {
    if(!currentFocusItemId) return;
    const itemIndex = items.findIndex(i => i.id === currentFocusItemId);
    if(itemIndex === -1) return;
    const currentTotal = items[itemIndex].focusTime || 0;
    const newTotal = currentTotal + focusSeconds; 
    items[itemIndex].focusTime = newTotal;
    const minsAdd = Math.floor(focusSeconds / 60);
    if(minsAdd > 0) showToast(`+${minsAdd} minutos registrados!`, "success");
    focusSeconds = 0; 
    document.getElementById("focusTimerDisplay").innerText = "00:00";
    await window.fbOps.updateDoc(window.fbOps.doc(window.db, "items", currentFocusItemId), { focusTime: newTotal });
}

// ------------------------------------

window.loadCommunityFeed = async () => {
    isCommunityMode = true;
    currentFilter = 'all'; currentStatusFilter = 'all';
    document.querySelectorAll(".menu-item").forEach(b => b.classList.remove("active"));
    document.querySelector(".stats-grid").style.display = "none";
    document.querySelector(".dashboard-stats").style.display = "none";
    document.querySelector(".input-section-unified").style.display = "none";
    const list = document.getElementById("list");
    list.innerHTML = `<div class="skeleton"></div><div class="skeleton"></div>`;
    try {
        const q = window.fbOps.query(window.fbOps.collection(window.db, "items"), window.fbOps.orderBy("createdAt", "desc"), window.fbOps.limit(50));
        const snap = await window.fbOps.getDocs(q);
        items = []; snap.forEach(d => items.push({id: d.id, ...d.data()}));
        render();
    } catch(e) {
        const q = window.fbOps.query(window.fbOps.collection(window.db, "items"), window.fbOps.limit(50));
        const snap = await window.fbOps.getDocs(q);
        items = []; snap.forEach(d => items.push({id: d.id, ...d.data()}));
        render();
    }
};

window.loadUserFeed = async (targetUid, targetName) => {
    isCommunityMode = true; 
    const list = document.getElementById("list");
    list.innerHTML = `<div class="skeleton"></div>`;
    const q = window.fbOps.query(window.fbOps.collection(window.db, "items"), window.fbOps.where("userId", "==", targetUid));
    const snap = await window.fbOps.getDocs(q);
    items = []; snap.forEach(d => items.push({id: d.id, ...d.data()}));
    render();
    const banner = document.createElement("div");
    banner.className = "user-filter-banner";
    banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px">
            <span><i class="fa-solid fa-eye"></i> Lista de <b>${targetName}</b></span>
            <button onclick="openBattle('${targetUid}', '${targetName}')" style="background:var(--danger); border:none; color:white; padding:5px 10px; border-radius:5px; font-size:0.8rem; cursor:pointer; font-weight:bold"><i class="fa-solid fa-gavel"></i> Comparar</button>
        </div>
        <button class="btn-dice" onclick="loadCommunityFeed()" style="width:auto; padding:5px 15px; font-size:0.8rem">Voltar</button>
    `;
    list.prepend(banner);
};

window.toggleLike = async (itemId) => {
    if(!currentUser) return showToast("Faça login.", "error");
    const itemIndex = items.findIndex(i => i.id === itemId);
    if(itemIndex === -1) return;
    const item = items[itemIndex];
    let likes = item.likes || [];
    if(likes.includes(currentUser.uid)) { likes = likes.filter(uid => uid !== currentUser.uid); } 
    else { likes.push(currentUser.uid); confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } }); }
    items[itemIndex].likes = likes;
    render();
    await window.fbOps.updateDoc(window.fbOps.doc(window.db, "items", itemId), { likes: likes });
};

async function loadUserProfile() {
    if(!currentUser) return;
    try {
        const docRef = window.fbOps.doc(window.db, "user_prefs", currentUser.uid);
        const docSnap = await window.fbOps.getDoc(docRef);
        if (docSnap.exists()) userPreferences = docSnap.data();
    } catch (e) { console.error(e); }
}

window.filterItems = async (c) => { 
    if(isCommunityMode) { document.querySelectorAll(".menu-item").forEach(b => b.classList.remove("active")); await loadItems(); }
    currentFilter = c; 
    document.querySelectorAll(".menu-item").forEach(b => b.classList.remove("active"));
    if (c.startsWith("list:")) { renderCollectionsSidebar(); } 
    else {
        const selector = c === 'all' ? 'Minha Lista' : c.charAt(0).toUpperCase() + c.slice(1);
        document.querySelectorAll(".menu-item").forEach(b => { if(b.innerText.includes(selector)) b.classList.add("active"); });
    }
    render(); 
    if(window.innerWidth < 900) toggleSidebar(); 
};
window.filterStatus = (s) => { currentStatusFilter = s; document.querySelectorAll(".status-tab").forEach(b => b.classList.remove("active")); event.target.closest("button").classList.add("active"); render(); };

function render() {
    const list = document.getElementById("list"); 
    const existingBanner = document.querySelector(".user-filter-banner");
    const term = document.getElementById("localSearch").value.toLowerCase(); 
    const sortMode = document.getElementById("sortOrder").value;
    list.innerHTML = "";
    if(existingBanner) list.appendChild(existingBanner);
    
    let filtered = items.filter(i => {
        let matchCategory = false;
        if (currentFilter === 'all') { matchCategory = true; } 
        else if (currentFilter.startsWith('list:')) {
            const listId = currentFilter.split(':')[1];
            matchCategory = i.lists && i.lists.includes(listId);
        } else { matchCategory = i.category === currentFilter; }
        const matchStatus = currentStatusFilter === 'all' || i.status === currentStatusFilter;
        const matchSearch = i.title.toLowerCase().includes(term);
        return matchCategory && matchStatus && matchSearch;
    });

    if (!filtered.length && items.length) { 
        const msg = document.createElement("div"); msg.className="empty-state"; msg.innerHTML = `<i class="fa-solid fa-ghost"></i><p>Nada encontrado.</p>`; list.appendChild(msg); return; 
    }
    if (!items.length && currentUser && !isCommunityMode) { 
        list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-compass"></i><p>Sua jornada começa aqui.</p></div>`; return; 
    }
    
    filtered.sort((a, b) => {
        if (sortMode === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
        if (sortMode === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
        if (sortMode === 'ratingDesc') return (b.rating || 0) - (a.rating || 0);
        return 0;
    });

    filtered.forEach(item => {
        const isMine = currentUser && item.userId === currentUser.uid;
        const card = document.createElement("div"); 
        card.className = `card ${item.status === 'Finalizado' ? 'card-completed' : ''} ${!isMine ? 'not-mine' : ''}`;
        
        let userHeader = '';
        if (isCommunityMode && !isMine) {
            const uName = item.userName || "Anônimo";
            const uPhoto = item.userPhoto || "https://via.placeholder.com/30";
            userHeader = `<div class="user-card-header" onclick="loadUserFeed('${item.userId}', '${uName}')" title="Ver lista de ${uName}"><img src="${uPhoto}" class="user-avatar-small"><span class="user-name-label"><strong>${uName}</strong> indicou:</span></div>`;
        } else if (isCommunityMode && isMine) {
            userHeader = `<div class="user-card-header" style="cursor:default; background:rgba(99,102,241,0.1)"><span class="user-name-label" style="color:var(--primary)">Sua publicação</span></div>`;
        }

        const likes = item.likes || [];
        const iLiked = currentUser && likes.includes(currentUser.uid);
        const likeBtn = `<button class="btn-like ${iLiked ? 'liked' : ''}" onclick="event.stopPropagation(); toggleLike('${item.id}')" title="${iLiked ? 'Descurtir' : 'Curtir'}"><i class="fa-${iLiked ? 'solid' : 'regular'} fa-heart"></i><span style="font-size:0.8rem">${likes.length || ''}</span></button>`;

        const labels = statusLabels[item.category] || statusLabels.filmes;
        const stars = [0,1,2,3,4,5].map(n => `<option value="${n}" ${item.rating == n ? 'selected':''}>${n==0?'Nota':'⭐'.repeat(n)}</option>`).join("");
        let finishedHtml = item.finishedAt ? `<div class="finished-date"><i class="fa-regular fa-calendar-check"></i> ${new Date(item.finishedAt).toLocaleDateString()}</div>` : '';
        let providersHtml = (item.providers && item.providers.length > 0) ? `<div class="providers-container"><div class="provider-label">Disponível em:</div>${item.providers.slice(0, 5).map(p => `<img src="${p.icon}" title="${p.name}" class="provider-icon">`).join('')}</div>` : '';
        
        let seriesHtml = '';
        if (item.category === 'series' && item.status !== 'Finalizado') {
            const s = item.season || 1; const e = item.episode || 1;
            seriesHtml = `<div class="series-control"><div class="control-group" title="Temporada"><span style="color:var(--text-muted);font-size:0.7rem">TEMP</span><button class="btn-mini" ${isMine?`onclick="event.stopPropagation();updateProgressSeries('${item.id}', 'season', -1)"`:''}>-</button><span>${s}</span><button class="btn-mini" ${isMine?`onclick="event.stopPropagation();updateProgressSeries('${item.id}', 'season', 1)"`:''}>+</button></div><div class="control-group" title="Episódio"><span style="color:var(--text-muted);font-size:0.7rem">EP</span><button class="btn-mini" ${isMine?`onclick="event.stopPropagation();updateProgressSeries('${item.id}', 'episode', -1)"`:''}>-</button><span>${e}</span><button class="btn-mini" ${isMine?`onclick="event.stopPropagation();updateProgressSeries('${item.id}', 'episode', 1)"`:''}>+</button></div></div>`;
        }

        const statusSelector = `<select class="status-badge ${item.status === 'Finalizado' ? 'status-done' : ''}" onchange="updateItem('${item.id}', 'status', this.value)" onclick="event.stopPropagation()" ${!isMine ? 'disabled' : ''}><option value="Começando" ${item.status === 'Começando' ? 'selected' : ''}>⏳ Na Fila</option><option value="Assistindo" ${item.status === 'Assistindo' ? 'selected' : ''}>${labels.progress}</option><option value="Finalizado" ${item.status === 'Finalizado' ? 'selected' : ''}>${labels.done}</option></select>`;
        
        card.innerHTML = `
            ${userHeader}
            <div class="card-image-container" onclick="openDetails('${item.id}')">
                <img src="${item.image || 'https://via.placeholder.com/300'}" alt="${item.title}" loading="lazy">
                ${statusSelector}
            </div>
            <div class="card-body">
                <div style="display:flex; justify-content:space-between; align-items:flex-start">
                    <strong>${item.title}</strong>
                    ${isCommunityMode ? likeBtn : ''}
                </div>
                ${finishedHtml}
                ${seriesHtml}
                ${providersHtml}
                ${isMine ? `
                    <select class="rating-stars" onchange="updateItem('${item.id}', 'rating', this.value)">${stars}</select>
                    <textarea class="review-area" placeholder="Resenha..." onblur="updateItem('${item.id}', 'review', this.value)">${item.review || ''}</textarea>
                ` : `
                    <div class="oracle-rating" style="margin-top:5px; font-size:0.9rem">⭐ ${item.rating > 0 ? item.rating + '/5' : 'Sem nota'}</div>
                    <p style="font-size:0.85rem; color:var(--text-muted); font-style:italic; margin-top:5px; background:rgba(0,0,0,0.2); padding:5px; border-radius:4px">"${item.review || 'Sem opinião.'}"</p>
                `}
                <div class="card-actions">
                    <button class="btn-share" onclick="shareItem('${item.title}', ${item.rating})"><i class="fa-solid fa-share-nodes"></i></button>
                    ${isMine ? `<button class="btn-folder" onclick="openManageLists('${item.id}')" title="Adicionar à coleção"><i class="fa-regular fa-folder-open"></i></button>` : ''}
                    ${isMine ? `<button class="btn-trash" onclick="deleteItem('${item.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
            </div>`;
        list.appendChild(card);
    });
    
    if(!isCommunityMode) updateStatsAndLevel();
}

function updateStatsAndLevel() {
    ['filmes','series','jogos','livros'].forEach(c => document.getElementById(`count-${c}`).innerText = myItems.filter(i=>i.category===c).length);
    const total = myItems.length; 
    if(total) {
        const doneItems = myItems.filter(i=>i.status==='Finalizado');
        ['filmes','series','jogos','livros'].forEach(c => document.getElementById(`bar-${c}`).style.width=`${(doneItems.filter(i=>i.category===c).length/total)*100}%`);
        document.getElementById("progressText").innerText=`${Math.round((doneItems.length/total)*100)}%`;
    }
    if(currentUser) {
        const finishedCount = myItems.filter(i => i.status === 'Finalizado').length;
        const level = Math.floor(finishedCount / 5) + 1;
        const titles = ["Novato", "Explorador", "Caçador", "Mestre", "Lendário", "Divindade"];
        const title = titles[Math.min(level - 1, titles.length - 1)];
        document.getElementById("userName").innerHTML = `${currentUser.displayName.split(" ")[0]} <span class="user-level-badge" title="${finishedCount} completados">LVL ${level} ${title}</span>`;
    }
}

window.openProfile = () => {
    if(currentUser) document.getElementById("profileNameDisplay").innerText = currentUser.displayName;
    const mList = document.getElementById("movieGenresList"); 
    const gList = document.getElementById("gameGenresList");
    const bList = document.getElementById("bookGenresList"); 

    mList.innerHTML = GENRES_DB.movies.map(g => `<div class="genre-tag ${userPreferences.movies?.includes(g.id)?'selected':''}" onclick="toggleGenre('movies', ${g.id}, this)">${g.name}</div>`).join('');
    gList.innerHTML = GENRES_DB.games.map(g => `<div class="genre-tag ${userPreferences.games?.includes(g.id)?'selected':''}" onclick="toggleGenre('games', '${g.id}', this)">${g.name}</div>`).join('');
    bList.innerHTML = GENRES_DB.books.map(g => `<div class="genre-tag ${userPreferences.books?.includes(g.id)?'selected':''}" onclick="toggleGenre('books', '${g.id}', this)">${g.name}</div>`).join('');

    let totalMins = 0;
    myItems.forEach(i => {
        if(i.status === 'Finalizado') {
            if(i.category === 'filmes') totalMins += 120;
            if(i.category === 'series') totalMins += ((i.season||1) * (i.episode||10) * 45);
            if(i.category === 'jogos') totalMins += 900;
            if(i.category === 'livros') totalMins += 300;
        }
        if(i.focusTime) totalMins += (i.focusTime / 60);
    });
    document.getElementById("totalHours").innerText = Math.floor(totalMins / 60) + "h";
    document.getElementById("totalCompleted").innerText = myItems.filter(i => i.status === 'Finalizado').length;
    const achGrid = document.getElementById("achievementsGrid");
    achGrid.innerHTML = ACHIEVEMENTS.map(ach => {
        const unlocked = ach.check(myItems);
        return `<div class="achievement-badge ${unlocked ? 'unlocked' : ''}" title="${ach.title}"><i class="fa-solid ${ach.icon}"></i><span class="ach-title">${ach.title}</span></div>`;
    }).join('');
    document.getElementById("profileModal").style.display = "flex";
};
window.closeProfile = () => document.getElementById("profileModal").style.display = "none";
window.toggleGenre = (type, id, el) => {
    el.classList.toggle("selected");
    if(!userPreferences[type]) userPreferences[type] = [];
    if(userPreferences[type].includes(id)) userPreferences[type] = userPreferences[type].filter(x => x !== id);
    else userPreferences[type].push(id);
};
window.saveProfile = async () => {
    if(!currentUser) return showToast("Faça login.", "error");
    try { 
        await window.fbOps.setDoc(window.fbOps.doc(window.db, "user_prefs", currentUser.uid), { 
            uid: currentUser.uid, 
            movies: userPreferences.movies || [], 
            games: userPreferences.games || [],
            books: userPreferences.books || [] 
        }); 
        showToast("Preferências salvas!", "success"); 
        closeProfile(); 
    } catch(e) { showToast("Erro: "+e.message, "error"); }
};

window.pickRandom = () => { document.getElementById("oracleModal").style.display = "flex"; document.getElementById("oracleResult").style.display = "none"; document.querySelector(".oracle-buttons").style.display = "flex"; };
window.closeOracle = () => { document.getElementById("oracleModal").style.display = "none"; };
window.retryOracle = () => { document.getElementById("oracleResult").style.display = "none"; document.querySelector(".oracle-buttons").style.display = "flex"; };

window.getRecommendation = async (type) => {
    const resBox = document.getElementById("oracleResult"); const btnBox = document.querySelector(".oracle-buttons"); btnBox.style.display = "none"; resBox.style.display = "block";
    const hasPrefs = (type === 'game' && userPreferences.games?.length > 0) || (type === 'book' && userPreferences.books?.length > 0) || (type !== 'game' && type !== 'book' && userPreferences.movies?.length > 0);
    resBox.innerHTML = `<p style='text-align:center;width:100%;padding:20px'>${hasPrefs ? '🔮 Personalizando...' : '🔮 Consultando os astros...'}</p>`;
    try {
        let item = null; let finalType = type; 
        
        if (type === 'game') {
            let url = userPreferences.games?.length ? `https://api.rawg.io/api/games?key=${RAWG_KEY}&genres=${userPreferences.games[Math.floor(Math.random()*userPreferences.games.length)]}&ordering=-metacritic&page_size=20&page=1` : `https://api.rawg.io/api/games?key=${RAWG_KEY}&ordering=-metacritic&page_size=20&page=${Math.floor(Math.random()*5)+1}`;
            const req = await fetch(url); const data = await req.json();
            let results = data.results; if(!results || !results.length) { const fb = await fetch(`https://api.rawg.io/api/games?key=${RAWG_KEY}&ordering=-metacritic&page_size=20&page=1`); const fbd = await fb.json(); results = fbd.results; }
            const raw = results[Math.floor(Math.random()*results.length)];
            item = { title: raw.name, image: raw.background_image || 'https://via.placeholder.com/300x200', overview: `Nota: ${raw.rating}/5. Gêneros: ${raw.genres?.map(g=>g.name).join(', ')}.`, rating: raw.rating, id: raw.id }; finalType = 'jogos';
        
        } else if (type === 'book') {
            const genre = (userPreferences.books && userPreferences.books.length > 0) ? userPreferences.books[Math.floor(Math.random() * userPreferences.books.length)] : 'fiction';
            const url = `https://www.googleapis.com/books/v1/volumes?q=subject:${genre}&langRestrict=pt&maxResults=20&orderBy=relevance`;
            const req = await fetch(url); const data = await req.json();
            if (!data.items || !data.items.length) throw new Error("Nenhum livro encontrado");
            const raw = data.items[Math.floor(Math.random() * data.items.length)];
            const info = raw.volumeInfo;
            item = { 
                title: info.title, 
                image: info.imageLinks?.thumbnail?.replace('http:', 'https:') || 'https://via.placeholder.com/300x450', 
                overview: info.description ? (info.description.substring(0, 200) + "...") : "Sem descrição.", 
                rating: info.averageRating || 0, 
                id: raw.id 
            };
            finalType = 'livros';

        } else {
            const ep = type === 'movie' ? 'movie' : 'tv';
            let url = userPreferences.movies?.length ? `https://api.themoviedb.org/3/discover/${ep}?api_key=${TMDB_KEY}&language=pt-BR&sort_by=popularity.desc&with_genres=${userPreferences.movies.join('|')}&page=1` : `https://api.themoviedb.org/3/${ep}/top_rated?api_key=${TMDB_KEY}&language=pt-BR&page=${Math.floor(Math.random()*5)+1}`;
            const req = await fetch(url); const data = await req.json(); if(!data.results?.length) throw new Error("Nada encontrado");
            const raw = data.results[Math.floor(Math.random()*data.results.length)];
            item = { title: raw.title||raw.name, image: raw.poster_path ? `https://image.tmdb.org/t/p/w500${raw.poster_path}` : 'https://via.placeholder.com/300', overview: raw.overview || "Sem sinopse.", rating: raw.vote_average, id: raw.id }; finalType = type === 'movie' ? 'filmes' : 'series';
        }
        
        currentOracleItem = item; currentOracleType = finalType; 
        if(type !== 'book') fetchProviders(finalType, item.id).then(p => { currentOracleItem.providers = p; });
        
        resBox.innerHTML = `<img src="${item.image}" alt="Capa"><div class="oracle-info"><h3>${item.title}</h3><p>${item.overview}</p><div class="oracle-rating"><i class="fa-solid fa-star"></i> ${item.rating?item.rating.toFixed(1):'?'}</div>${hasPrefs ? '<div style="font-size:0.7rem;color:var(--success);margin-bottom:5px"><i class="fa-solid fa-check"></i> Recomendado</div>' : ''}<div class="oracle-actions"><button onclick="saveOracleItem()" class="btn-submit-large"><i class="fa-solid fa-plus"></i> Adicionar</button><button onclick="retryOracle()" class="btn-dice" style="margin-top:10px;background:var(--bg-dark);border:1px solid var(--border);color:var(--text)"><i class="fa-solid fa-rotate-right"></i> Tentar Outro</button></div></div>`;
    } catch (e) { resBox.innerHTML = `<p>Erro: ${e.message}</p><button onclick='retryOracle()'>Voltar</button>`; }
};

window.saveOracleItem = async () => {
    if(!currentUser || !currentOracleItem) return showToast("Erro", "error");
    const newItem = { 
        title: currentOracleItem.title, image: currentOracleItem.image, category: currentOracleType, status: "Começando", rating: 0, review: `Sugestão do Oráculo.`, overview: currentOracleItem.overview, 
        userId: currentUser.uid, userName: currentUser.displayName, userPhoto: currentUser.photoURL, likes: [],
        createdAt: new Date().toISOString(), providers: currentOracleItem.providers||[] 
    };
    await window.fbOps.addDoc(window.fbOps.collection(window.db,"items"), newItem); showToast("Adicionado!", "success"); closeOracle(); confetti(); 
    if(isCommunityMode) loadCommunityFeed(); else loadItems();
};

window.openDetails = (id) => {
    currentFocusItemId = id; 
    const item = items.find(i => i.id === id); if (!item) return;
    const isMine = currentUser && item.userId === currentUser.uid;
    document.getElementById("cineImage").src = item.image; document.getElementById("cineBackground").style.backgroundImage = `url(${item.image})`;
    document.getElementById("cineTitle").innerText = item.title; document.getElementById("cineCategory").innerText = item.category;
    document.getElementById("cineDate").innerHTML = `<i class="fa-regular fa-calendar"></i> ${item.createdAt ? new Date(item.createdAt).getFullYear() : '---'}`;
    document.getElementById("cineStatus").innerText = item.status;
    document.getElementById("cineOverview").innerText = item.overview || item.review || "Sem informações adicionais.";
    
    // Configura Visual do Timer
    clearInterval(focusInterval); isFocusing = false; focusSeconds = 0;
    document.getElementById("focusTimerDisplay").innerText = "00:00";
    document.getElementById("btnToggleTimer").innerHTML = '<i class="fa-solid fa-play"></i> Focar';
    document.getElementById("btnToggleTimer").classList.remove("stop");
    document.getElementById("focusSessionInfo").style.display = "none";
    
    const totalMins = item.focusTime ? Math.floor(item.focusTime / 60) : 0;
    if(totalMins > 0) document.getElementById("focusSessionInfo").innerText = `Total: ${totalMins} min`;
    else document.getElementById("focusSessionInfo").innerText = "";

    document.querySelector(".focus-timer-box").style.display = isMine ? "flex" : "none";

    const provDiv = document.getElementById("cineProviders");
    if (item.providers && item.providers.length > 0) provDiv.innerHTML = item.providers.map(p => `<img src="${p.icon}" title="${p.name}" class="provider-icon" style="width:40px;height:40px">`).join('');
    else provDiv.innerHTML = '<span style="color:var(--text-muted);font-size:0.8rem">Nenhum provedor registrado.</span>';
    const btnDel = document.getElementById("btnDeleteDetail");
    if(isMine) { btnDel.style.display = "flex"; btnDel.onclick = async () => { if(confirm("Tem certeza?")) { await window.deleteItem(id); closeDetails(); } }; } else { btnDel.style.display = "none"; }
    document.getElementById("detailsModal").style.display = "flex";
};

window.closeDetails = () => { 
    if(isFocusing) saveFocusSession(); 
    clearInterval(focusInterval);
    document.getElementById("detailsModal").style.display = "none"; 
};

async function fetchProviders(type, id) {
    try {
        if (type === 'filmes' || type === 'series' || type === 'filmes' || type === 'tv') {
            const endpoint = (type === 'filmes' || type === 'movie') ? 'movie' : 'tv';
            const req = await fetch(`https://api.themoviedb.org/3/${endpoint}/${id}/watch/providers?api_key=${TMDB_KEY}`); const data = await req.json();
            if (data.results?.BR?.flatrate) return data.results.BR.flatrate.map(p => ({name: p.provider_name, icon: `https://image.tmdb.org/t/p/original${p.logo_path}`}));
        } else if (type === 'jogos') {
            const req = await fetch(`https://api.rawg.io/api/games/${id}?key=${RAWG_KEY}`); const data = await req.json();
            if (data.stores) return data.stores.map(s => { const n = s.store.name; let i=''; if(n.includes('Steam')) i='https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg'; else if(n.includes('PlayStation')) i='https://upload.wikimedia.org/wikipedia/commons/0/00/PlayStation_logo.svg'; else if(n.includes('Xbox')) i='https://upload.wikimedia.org/wikipedia/commons/f/f9/Xbox_one_logo.svg'; else if(n.includes('Epic')) i='https://upload.wikimedia.org/wikipedia/commons/3/31/Epic_Games_logo.svg'; else if(n.includes('Nintendo')) i='https://upload.wikimedia.org/wikipedia/commons/0/0d/Nintendo.svg'; return i ? {name:n, icon:i} : null; }).filter(i=>i!==null);
        }
    } catch(e){} return [];
}

window.searchApi = async () => {
    const q = document.getElementById("smartSearchInput").value; const cat = document.getElementById("smartCategory").value;
    document.getElementById("title").value = q; currentSelectedProviders = []; document.getElementById("overviewInput").value = ""; if(!q) return;
    const resDiv = document.getElementById("apiResults"); resDiv.innerHTML = "<p style='color:gray;padding:10px;text-align:center'>🔎 Buscando...</p>";
    try {
        let results = [];
        if (cat === 'livros') { const req = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=4`); const data = await req.json(); results = data.items?.map(i => ({id: i.id, title: i.volumeInfo.title, image: i.volumeInfo.imageLinks?.thumbnail?.replace('http:','https:')||'', overview: i.volumeInfo.description}))||[]; }
        else if (cat === 'jogos') { const req = await fetch(`https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${q}&page_size=4`); const data = await req.json(); results = data.results?.map(i => ({id: i.id, title: i.name, image: i.background_image, overview: `Lançado: ${i.released}. Nota: ${i.rating}`}))||[]; }
        else if (cat === 'filmes') { const req = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${q}&language=pt-BR`); const data = await req.json(); results = data.results?.slice(0,4).map(i => ({id: i.id, title: i.title, image: i.poster_path ? `https://image.tmdb.org/t/p/w500${i.poster_path}` : '', overview: i.overview}))||[]; }
        else if (cat === 'series') { const req = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${q}&language=pt-BR`); const data = await req.json(); results = data.results?.slice(0,4).map(i => ({id: i.id, title: i.name, image: i.poster_path ? `https://image.tmdb.org/t/p/w500${i.poster_path}` : '', overview: i.overview}))||[]; }
        resDiv.innerHTML = ""; if(!results.length) { resDiv.innerHTML="<p style='padding:10px;text-align:center;color:grey'>Nada encontrado.</p>"; return; }
        results.forEach(res => {
            const div = document.createElement("div"); div.className="api-item"; div.innerHTML=`<img src="${res.image||'https://via.placeholder.com/150'}"><span>${res.title}</span>`;
            div.onclick = async () => {
                document.getElementById("smartSearchInput").value = res.title; document.getElementById("title").value = res.title; document.getElementById("image").value = res.image; document.getElementById("overviewInput").value = res.overview || "";
                resDiv.innerHTML=`<div style="padding:10px;text-align:center;color:#10b981"><i class="fa-solid fa-spinner fa-spin"></i> Buscando disponibilidade...</div>`;
                currentSelectedProviders = await fetchProviders(cat, res.id);
                resDiv.innerHTML=`<div style="padding:10px;text-align:center;color:#10b981"><i class="fa-solid fa-check-circle"></i> Selecionado: <b>${res.title}</b></div>`;
                if(currentSelectedProviders.length>0) showToast(`Disponível em ${currentSelectedProviders.length} plataformas!`, 'success');
            };
            resDiv.appendChild(div);
        });
    } catch(e) { resDiv.innerHTML="Erro na busca."; }
};

window.updateProgressSeries = async (id, type, change) => { const idx = items.findIndex(i => i.id === id); if (idx === -1) return; let val = (items[idx][type] || 1) + change; if (val < 1) val = 1; items[idx][type] = val; render(); const data = {}; data[type] = val; await window.fbOps.updateDoc(window.fbOps.doc(window.db, "items", id), data); };
window.updateItem = async (id, f, v) => { const d = {}; if(f==='status' && v==='Finalizado') { confetti(); d.finishedAt=new Date().toISOString(); } d[f] = f==='rating'?parseInt(v):v; await window.fbOps.updateDoc(window.fbOps.doc(window.db,"items",id), d); const i = items.find(x=>x.id===id); if(i){ i[f]=d[f]; if(d.finishedAt) i.finishedAt=d.finishedAt; } if(f==='status') render(); showToast("Item atualizado"); };
window.deleteItem = async (id) => { if(confirm("Remover?")) { await window.fbOps.deleteDoc(window.fbOps.doc(window.db,"items",id)); await loadItems(); showToast("Item removido"); }};
window.shareItem = (t,r) => { const msg=`HobbyDEX: ${t} (${r}⭐)`; if(navigator.share) navigator.share({text:msg}); else { navigator.clipboard.writeText(msg); showToast("Copiado!"); } };
window.exportData = () => { if(!myItems.length) return showToast("Lista vazia.", "error"); let csv = "\uFEFFTítulo,Categoria,Status,Nota,Resenha,Data\n"; myItems.forEach(i => { csv += `"${(i.title||"").replace(/"/g,'""')}",${i.category},${i.status},${i.rating||0},"${(i.review||"").replace(/"/g,'""')}",${i.createdAt||""}\n`; }); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'})); a.download = `HobbyDEX_Backup.csv`; a.click(); showToast("Backup baixado!", "success"); };

document.getElementById("itemForm").onsubmit = async (e) => { 
    e.preventDefault(); if(!currentUser) return showToast("Faça login.", "error"); 
    const t = document.getElementById("title").value || document.getElementById("smartSearchInput").value; if(!t) return showToast("Digite um nome", "error"); 
    const s = document.getElementById("status").value; const overview = document.getElementById("overviewInput").value; 
    const obj = { 
        title: t, image: document.getElementById("image").value, category: document.getElementById("smartCategory").value, status: s, 
        rating: 0, review: "", overview: overview, userId: currentUser.uid, userName: currentUser.displayName, userPhoto: currentUser.photoURL, likes: [],
        createdAt: new Date().toISOString(), providers: currentSelectedProviders||[] 
    }; 
    if(s==='Finalizado') { obj.finishedAt = new Date().toISOString(); confetti(); } 
    await window.fbOps.addDoc(window.fbOps.collection(window.db,"items"), obj); 
    e.target.reset(); document.getElementById("apiResults").innerHTML=""; 
    showToast("Compartilhado com a comunidade!", "success");
    if(isCommunityMode) window.loadCommunityFeed(); else loadItems();
};

document.getElementById("logoutBtn").onclick = () => window.fbOps.signOut(window.auth);
window.handleLocalSearch = render;

initApp();