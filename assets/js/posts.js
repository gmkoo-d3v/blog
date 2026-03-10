const sourceCache = new Map();
const filterState = {
  q: "",
  tag: "",
  page: 1,
};

const normalizeText = (value) => String(value || "").toLowerCase().trim();

const readFilterStateFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  filterState.q = normalizeText(params.get("q"));
  filterState.tag = (params.get("tag") || "").trim();
  const parsedPage = Number.parseInt(params.get("page") || "1", 10);
  filterState.page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
};

const writeFilterStateToUrl = () => {
  const params = new URLSearchParams(window.location.search);

  if (filterState.q) {
    params.set("q", filterState.q);
  } else {
    params.delete("q");
  }

  if (filterState.tag) {
    params.set("tag", filterState.tag);
  } else {
    params.delete("tag");
  }

  if (filterState.page > 1) {
    params.set("page", String(filterState.page));
  } else {
    params.delete("page");
  }

  const query = params.toString();
  const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState({}, "", nextUrl);
};

const loadPosts = async (source) => {
  if (!sourceCache.has(source)) {
    sourceCache.set(
      source,
      fetch(source).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${source}`);
        }

        const posts = await response.json();
        return [...posts].sort((left, right) => right.date.localeCompare(left.date));
      })
    );
  }

  return sourceCache.get(source);
};

const matchesSearch = (post, query) => {
  if (!query) {
    return true;
  }

  const haystack = [
    post.title,
    post.summary,
    post.category,
    post.sectionLabel,
    ...(post.tags || []),
  ]
    .map(normalizeText)
    .join(" ");

  return haystack.includes(query);
};

const matchesTag = (post, tag) => {
  if (!tag) {
    return true;
  }

  return (post.tags || []).some((item) => item === tag);
};

const readStaticSections = (rawValue) => {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [slug, label] = entry.split(":").map((part) => part.trim());
      return { slug, label: label || slug };
    })
    .filter((section) => section.slug);
};

const updateSearchStatus = (count, total) => {
  const targets = document.querySelectorAll("[data-post-search-status]");
  const parts = [];

  if (filterState.q) {
    parts.push(`검색어: ${filterState.q}`);
  }

  if (filterState.tag) {
    parts.push(`태그: ${filterState.tag}`);
  }

  const paginationTarget = document.querySelector("[data-post-pagination]");
  const pageSize = Number(document.querySelector("[data-post-list]")?.dataset.pageSize || "0");
  const totalPages =
    paginationTarget && pageSize > 0 ? Math.max(1, Math.ceil(count / pageSize)) : 1;

  const summary = parts.length
    ? `${parts.join(" · ")} · ${count} / ${total}개`
    : `전체 ${total}개 글`;

  const withPage =
    paginationTarget && totalPages > 1
      ? `${summary} · ${filterState.page}/${totalPages} 페이지`
      : summary;

  targets.forEach((target) => {
    target.textContent = withPage;
  });
};

const syncSearchInputs = () => {
  document.querySelectorAll("[data-post-search-input]").forEach((input) => {
    input.value = filterState.q;
  });
};

const buildTagButton = (tag, count, active) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tag-filter";
  if (active) {
    button.classList.add("is-active");
  }

  const label = document.createElement("span");
  label.textContent = tag;

  const badge = document.createElement("span");
  badge.className = "tag-filter-count";
  badge.textContent = String(count);

  button.append(label, badge);
  button.addEventListener("click", () => {
    filterState.tag = filterState.tag === tag ? "" : tag;
    filterState.page = 1;
    writeFilterStateToUrl();
    renderAllPostUi().catch((error) => console.error(error));
  });

  return button;
};

const buildPaginationSequence = (totalPages, currentPage) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const sequence = [];

  sorted.forEach((page, index) => {
    sequence.push(page);
    const next = sorted[index + 1];
    if (next && next - page > 1) {
      sequence.push("ellipsis");
    }
  });

  return sequence;
};

const renderPagination = (totalItems, pageSize) => {
  const target = document.querySelector("[data-post-pagination]");

  if (!target) {
    return;
  }

  target.replaceChildren();

  if (!pageSize) {
    return;
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(filterState.page, totalPages);

  if (currentPage !== filterState.page) {
    filterState.page = currentPage;
    writeFilterStateToUrl();
  }

  if (totalPages <= 1) {
    return;
  }

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "pagination-button";
  prev.textContent = "이전";
  prev.disabled = currentPage === 1;
  prev.addEventListener("click", () => {
    if (currentPage === 1) {
      return;
    }
    filterState.page = currentPage - 1;
    writeFilterStateToUrl();
    renderAllPostUi().catch((error) => console.error(error));
  });
  target.append(prev);

  buildPaginationSequence(totalPages, currentPage).forEach((entry) => {
    if (entry === "ellipsis") {
      const ellipsis = document.createElement("span");
      ellipsis.className = "pagination-ellipsis";
      ellipsis.textContent = "...";
      target.append(ellipsis);
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "pagination-button";
    if (entry === currentPage) {
      button.classList.add("is-active");
    }
    button.textContent = String(entry);
    button.addEventListener("click", () => {
      filterState.page = entry;
      writeFilterStateToUrl();
      renderAllPostUi().catch((error) => console.error(error));
    });
    target.append(button);
  });

  const next = document.createElement("button");
  next.type = "button";
  next.className = "pagination-button";
  next.textContent = "다음";
  next.disabled = currentPage === totalPages;
  next.addEventListener("click", () => {
    if (currentPage === totalPages) {
      return;
    }
    filterState.page = currentPage + 1;
    writeFilterStateToUrl();
    renderAllPostUi().catch((error) => console.error(error));
  });
  target.append(next);
};

const renderPostCards = async () => {
  const containers = document.querySelectorAll("[data-post-list]");

  if (!containers.length) {
    return;
  }

  await Promise.all(
    [...containers].map(async (container) => {
      const sortedPosts = await loadPosts(container.dataset.source || "./posts.json");
      const root = container.dataset.root || "./";
      const layout = container.dataset.layout || "grid";
      const filterKey = container.dataset.filterKey;
      const filterValue = container.dataset.filterValue;
      const sectionFilteredPosts = filterKey
        ? sortedPosts.filter((post) => post[filterKey] === filterValue)
        : sortedPosts;
      const searchedPosts = sectionFilteredPosts.filter((post) =>
        matchesSearch(post, filterState.q)
      );
      const fullyFilteredPosts = searchedPosts.filter((post) =>
        matchesTag(post, filterState.tag)
      );
      const pageSize = Number(container.dataset.pageSize || "0");
      const applyLimit = !filterState.q && !filterState.tag;
      const limit = Number(container.dataset.limit || fullyFilteredPosts.length);
      const totalPages = pageSize
        ? Math.max(1, Math.ceil(fullyFilteredPosts.length / pageSize))
        : 1;
      const currentPage = pageSize ? Math.min(filterState.page, totalPages) : 1;

      if (pageSize && currentPage !== filterState.page) {
        filterState.page = currentPage;
        writeFilterStateToUrl();
      }

      const pagedPosts = pageSize
        ? fullyFilteredPosts.slice((currentPage - 1) * pageSize, currentPage * pageSize)
        : fullyFilteredPosts;
      const selectedPosts = pageSize
        ? pagedPosts
        : applyLimit
          ? fullyFilteredPosts.slice(0, limit)
          : fullyFilteredPosts;

      container.replaceChildren();

      if (!selectedPosts.length) {
        const emptyCard = document.createElement("article");
        emptyCard.className = layout === "list" ? "post-list-item" : "post-card";

        const title = document.createElement("h3");
        title.textContent = container.dataset.emptyTitle || "아직 글이 없습니다.";

        const summary = document.createElement("p");
        summary.className = "post-summary";
        summary.textContent =
          container.dataset.emptySummary || "새 글을 추가하면 이 영역에 표시됩니다.";

        emptyCard.append(title, summary);
        container.append(emptyCard);
        renderPagination(fullyFilteredPosts.length, pageSize);
        updateSearchStatus(fullyFilteredPosts.length, sectionFilteredPosts.length);
        return;
      }

      selectedPosts.forEach((post) => {
        const article = document.createElement("article");
        article.className = layout === "list" ? "post-list-item" : "post-card";

        const meta = document.createElement("p");
        meta.className = "post-category";
        const metaParts = [post.sectionLabel, post.category, post.date].filter(Boolean);
        meta.textContent = metaParts.join(" · ");

        const title = document.createElement("h3");
        const link = document.createElement("a");
        link.href = `${root}p/${post.sectionSlug}/${post.slug}/`;
        link.textContent = post.title;
        title.append(link);

        const summary = document.createElement("p");
        summary.className = "post-summary";
        summary.textContent = post.summary;

        article.append(meta, title, summary);

        if (layout !== "list") {
          const tags = document.createElement("div");
          tags.className = "tag-list";
          post.tags.forEach((tag) => {
            const chip = document.createElement("span");
            chip.className = "tag";
            chip.textContent = tag;
            tags.append(chip);
          });

          article.append(tags);
        }

        container.append(article);
      });

      renderPagination(fullyFilteredPosts.length, pageSize);
      updateSearchStatus(fullyFilteredPosts.length, sectionFilteredPosts.length);
    })
  );
};

const renderSectionLists = async () => {
  const containers = document.querySelectorAll("[data-section-list]");

  if (!containers.length) {
    return;
  }

  await Promise.all(
    [...containers].map(async (container) => {
      const posts = await loadPosts(container.dataset.source || "./posts.json");
      const root = container.dataset.root || "./";
      const activeSection = container.dataset.activeSection || "";
      const sections = new Map();
      const staticSections = readStaticSections(container.dataset.staticSections || "");

      staticSections.forEach((section) => {
        sections.set(section.slug, {
          label: section.label,
          count: 0,
        });
      });

      posts.forEach((post) => {
        if (!post.sectionSlug || !post.sectionLabel) {
          return;
        }

        const current = sections.get(post.sectionSlug) || {
          label: post.sectionLabel,
          count: 0,
        };
        current.label = current.label || post.sectionLabel;
        current.count += 1;
        sections.set(post.sectionSlug, current);
      });

      container.replaceChildren();

      [...sections.entries()].forEach(([sectionSlug, section]) => {
        const link = document.createElement("a");
        link.className = "sidebar-link";
        if (sectionSlug === activeSection) {
          link.classList.add("is-active");
        }
        link.href = `${root}category/${sectionSlug}/`;

        const label = document.createElement("span");
        label.textContent = section.label;

        const count = document.createElement("span");
        count.className = "sidebar-count";
        count.textContent = String(section.count);

        link.append(label, count);
        container.append(link);
      });
    })
  );
};

const renderTagLists = async () => {
  const containers = document.querySelectorAll("[data-tag-list]");

  if (!containers.length) {
    return;
  }

  await Promise.all(
    [...containers].map(async (container) => {
      const posts = await loadPosts(container.dataset.source || "./posts.json");
      const filterKey = container.dataset.filterKey;
      const filterValue = container.dataset.filterValue;
      const scopedPosts = filterKey
        ? posts.filter((post) => post[filterKey] === filterValue)
        : posts;
      const counts = new Map();

      scopedPosts.forEach((post) => {
        (post.tags || []).forEach((tag) => {
          counts.set(tag, (counts.get(tag) || 0) + 1);
        });
      });

      container.replaceChildren();

      [...counts.entries()]
        .sort((left, right) => left[0].localeCompare(right[0], "ko"))
        .forEach(([tag, count]) => {
          container.append(buildTagButton(tag, count, filterState.tag === tag));
        });
    })
  );
};

const bindSearchControls = () => {
  const inputs = document.querySelectorAll("[data-post-search-input]");
  const clearButtons = document.querySelectorAll("[data-post-search-clear]");

  inputs.forEach((input) => {
    input.addEventListener("input", (event) => {
      filterState.q = normalizeText(event.target.value);
      filterState.page = 1;
      writeFilterStateToUrl();
      renderAllPostUi().catch((error) => console.error(error));
    });
  });

  clearButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterState.q = "";
      filterState.tag = "";
      filterState.page = 1;
      writeFilterStateToUrl();
      renderAllPostUi().catch((error) => console.error(error));
    });
  });
};

const renderAllPostUi = async () => {
  syncSearchInputs();
  await Promise.all([renderPostCards(), renderSectionLists(), renderTagLists()]);
};

document.addEventListener("DOMContentLoaded", () => {
  readFilterStateFromUrl();
  bindSearchControls();
  renderAllPostUi().catch((error) => {
    console.error(error);
  });
});
