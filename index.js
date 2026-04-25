const tableBody = document.getElementById("bookTableBody");
const searchInput = document.getElementById("searchInput");
const countEl = document.getElementById("count");
const imgModal = document.getElementById("imgModal");
const imgModalImage = document.getElementById("imgModalImage");
const imgModalTitle = document.getElementById("imgModalTitle");
const imgModalClose = document.getElementById("imgModalClose");
const sortButtons = Array.from(document.querySelectorAll(".sort-btn[data-sort-key]"));

let books = [];
const readStorageKey = "bookReadStateV1";
let readMap = {};
const sortState = { key: "sl", direction: "asc" };
const placeholderSvg =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="84">' +
        '<rect width="100%" height="100%" fill="#e7eef9"/>' +
        '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="11" font-family="Segoe UI, Arial" fill="#62748d">No Image</text>' +
        "</svg>"
    );

function textOrDash(value) {
    if (!value || !String(value).trim()) {
        return '<span class="empty">-</span>';
    }
    return escapeHtml(String(value));
}

function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function getBookKey(book, idx) {
    return `${idx}::${String(book.title || "").trim()}::${String(book.author || "").trim()}`;
}

function loadReadMap() {
    try {
        const raw = localStorage.getItem(readStorageKey);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function saveReadMap() {
    localStorage.setItem(readStorageKey, JSON.stringify(readMap));
}

function getReadStatus(book, idx) {
    const key = getBookKey(book, book.__id ?? idx);
    if (Object.prototype.hasOwnProperty.call(readMap, key)) {
        return !!readMap[key];
    }
    return !!book.read;
}

function getSortValue(book, key, idx) {
    if (key === "sl") {
        return book.__id ?? idx;
    }
    if (key === "read") {
        return getReadStatus(book, idx) ? 1 : 0;
    }
    if (key === "collected") {
        return book.collected ? 1 : 0;
    }
    return String(book[key] || "").toLowerCase();
}

function sortBooks(data) {
    const { key, direction } = sortState;
    const sorted = [...data];
    const factor = direction === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
        const av = getSortValue(a, key, 0);
        const bv = getSortValue(b, key, 0);
        if (av < bv) {
            return -1 * factor;
        }
        if (av > bv) {
            return 1 * factor;
        }
        return (a.__id ?? 0) - (b.__id ?? 0);
    });
    return sorted;
}

function updateSortIndicators() {
    sortButtons.forEach((btn) => {
        const arrow = btn.querySelector(".arrow");
        if (!arrow) {
            return;
        }
        const key = btn.dataset.sortKey;
        if (key === sortState.key) {
            arrow.textContent = sortState.direction === "asc" ? "^" : "v";
            btn.setAttribute("aria-label", `Sorted by ${key} ${sortState.direction}`);
            return;
        }
        arrow.textContent = "-";
        btn.setAttribute("aria-label", `Sort by ${key}`);
    });
}

function applyFiltersAndSort() {
    const filtered = filterBooks(searchInput.value || "");
    const sorted = sortBooks(filtered);
    renderRows(sorted);
    updateSortIndicators();
}

function renderRows(data) {
    if (!data.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="center empty">No books found</td>
            </tr>
        `;
        countEl.textContent = "0 results";
        return;
    }

    tableBody.innerHTML = data.map((book, idx) => {
        const collectedClass = book.collected ? "yes" : "no";
        const collectedText = book.collected ? "Yes" : "No";
        const key = getBookKey(book, book.__id ?? idx);
        const isRead = getReadStatus(book, idx);
        const readClass = isRead ? "yes" : "no";
        const readText = isRead ? "Yes" : "No";

        const thumbSrc = escapeHtml((book.thumbnail || "").trim() || placeholderSvg);
        const thumbAlt = book.title ? `Thumbnail of ${escapeHtml(String(book.title))}` : "Book thumbnail";
        const safeTitle = escapeHtml(String(book.title || "Book image"));

        return `
            <tr>
                <td class="center">${(book.__id ?? idx) + 1}</td>
                <td class="center">
                    <button class="thumb-btn" type="button" data-full="${thumbSrc}" data-title="${safeTitle}">
                        <img class="thumb" src="${thumbSrc}" alt="${thumbAlt}" loading="lazy" />
                    </button>
                </td>
                <td>${textOrDash(book.title)}</td>
                <td>${textOrDash(book.author)}</td>
                <td>${textOrDash(book.publisher)}</td>
                <td class="center">
                    <button class="pill ${readClass} read-toggle" type="button" data-read-key="${escapeHtml(key)}">${readText}</button>
                </td>
                <td class="center"><span class="pill ${collectedClass}">${collectedText}</span></td>
            </tr>
        `;
    }).join("");

    countEl.textContent = `${data.length} results`;
}

function openImageModal(src, title) {
    imgModalImage.src = src;
    imgModalTitle.textContent = title || "Book image";
    imgModalImage.alt = title || "Book image";
    imgModal.classList.add("open");
    imgModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeImageModal() {
    imgModal.classList.remove("open");
    imgModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function filterBooks(keyword) {
    const query = keyword.trim().toLowerCase();
    if (!query) {
        return books;
    }

    return books.filter((book) => {
        const title = (book.title || "").toLowerCase();
        const author = (book.author || "").toLowerCase();
        const publisher = (book.publisher || "").toLowerCase();
        return title.includes(query) || author.includes(query) || publisher.includes(query);
    });
}

async function loadBooks() {
    try {
        const response = await fetch("./data.json");
        if (!response.ok) {
            throw new Error(`Failed to load data.json (${response.status})`);
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error("Invalid JSON format. Expected an array.");
        }

        books = data.map((book, idx) => ({ ...book, __id: idx }));
        applyFiltersAndSort();
    } catch (error) {
        countEl.textContent = "Failed to load books";
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="center empty">${escapeHtml(error.message)}</td>
            </tr>
        `;
    }
}

searchInput.addEventListener("input", (event) => {
    applyFiltersAndSort();
});

tableBody.addEventListener("click", (event) => {
    const trigger = event.target.closest(".thumb-btn");
    if (!trigger) {
        return;
    }

    const src = trigger.dataset.full || placeholderSvg;
    const title = trigger.dataset.title || "Book image";
    openImageModal(src, title);
});

tableBody.addEventListener("click", (event) => {
    const toggle = event.target.closest(".read-toggle");
    if (!toggle) {
        return;
    }

    const key = toggle.dataset.readKey;
    if (!key) {
        return;
    }

    readMap[key] = !(readMap[key] === true);
    saveReadMap();
    applyFiltersAndSort();
});

sortButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        const key = btn.dataset.sortKey;
        if (!key) {
            return;
        }
        if (sortState.key === key) {
            sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
        } else {
            sortState.key = key;
            sortState.direction = "asc";
        }
        applyFiltersAndSort();
    });
});

imgModalClose.addEventListener("click", closeImageModal);

imgModal.addEventListener("click", (event) => {
    if (event.target === imgModal) {
        closeImageModal();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && imgModal.classList.contains("open")) {
        closeImageModal();
    }
});

readMap = loadReadMap();
loadBooks();
