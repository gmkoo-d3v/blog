const sourceCache = new Map();
const filterState = {
  q: "",
  tag: "",
};

const normalizeText = (value) => String(value || "").toLowerCase().trim();

const readFilterStateFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  filterState.q = normalizeText(params.get("q"));
  filterState.tag = (params.get("tag") || "").trim();
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

const updateSearchStatus = (count, total) => {
  const targets = document.querySelectorAll("[data-post-search-status]");
  const parts = [];

  if (filterState.q) {
    parts.push(`검색어: ${filterState.q}`);
  }

  if (filterState.tag) {
    parts.push(`태그: ${filterState.tag}`);
  }

  const summary = parts.length
    ? `${parts.join(" · ")} · ${count} / ${total}개`
    : `전체 ${total}개 글`;

  targets.forEach((target) => {
    target.textContent = summary;
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
    writeFilterStateToUrl();
    renderAllPostUi().catch((error) => console.error(error));
  });

  return button;
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
      const applyLimit = !filterState.q && !filterState.tag;
      const limit = Number(container.dataset.limit || fullyFilteredPosts.length);
      const selectedPosts = applyLimit
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
        link.href = `${root}p/${post.slug}/`;
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

      posts.forEach((post) => {
        if (!post.sectionSlug || !post.sectionLabel) {
          return;
        }

        const current = sections.get(post.sectionSlug) || {
          label: post.sectionLabel,
          count: 0,
        };
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
        link.href = `${root}${sectionSlug}/`;

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
      writeFilterStateToUrl();
      renderAllPostUi().catch((error) => console.error(error));
    });
  });

  clearButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterState.q = "";
      filterState.tag = "";
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
