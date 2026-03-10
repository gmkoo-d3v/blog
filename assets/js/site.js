const copyText = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "absolute";
  helper.style.left = "-9999px";
  document.body.append(helper);
  helper.select();
  document.execCommand("copy");
  helper.remove();
};

const PRISM_VERSION = "1.29.0";
const PRISM_BASE = `https://cdn.jsdelivr.net/npm/prismjs@${PRISM_VERSION}`;
const LANGUAGE_LABELS = {
  bash: "Bash",
  batch: "Batch",
  java: "Java",
  markdown: "Markdown",
  none: "Text",
  powershell: "PowerShell",
  shell: "Shell",
  sql: "SQL",
};

const loadStylesheet = (href) =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector(`link[data-dynamic-href="${href}"]`);

    if (existing) {
      resolve();
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.dynamicHref = href;
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", reject, { once: true });
    document.head.append(link);
  });

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-dynamic-src="${src}"]`);

    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }

      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.dataset.dynamicSrc = src;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );
    script.addEventListener("error", reject, { once: true });
    document.head.append(script);
  });

const detectLanguage = (source) => {
  const normalized = source.trim();

  if (!normalized) {
    return "none";
  }

  if (
    /(^|[\n\r])\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COMMIT|ROLLBACK|CHECKPOINT)\b/i.test(
      normalized
    )
  ) {
    return "sql";
  }

  if (
    /(brew |source ~\/|export [A-Z_]+|sudo |\/usr\/libexec\/java_home|java -version|javac -version|echo %JAVA_HOME%|where java|%JAVA_HOME%\\bin|sysdm\.cpl)/.test(
      normalized
    )
  ) {
    return normalized.includes("%JAVA_HOME%") || normalized.includes("sysdm.cpl") ? "batch" : "bash";
  }

  if (
    /(class [A-Z]\w*|System\.out\.|new ArrayList|List&lt;|Map&lt;|Set&lt;|int\[]|String\[]|Iterator&lt;|for \(.+:.+\)|public static void main)/.test(
      normalized
    )
  ) {
    return "java";
  }

  if (/!\[[^\]]*\]\([^)]+\)|^\s*#\s+/.test(normalized)) {
    return "markdown";
  }

  return "none";
};

const getLanguage = (code) => {
  const explicit = Array.from(code.classList).find((name) => name.startsWith("language-"));

  if (explicit) {
    return explicit.replace("language-", "");
  }

  return detectLanguage(code.innerHTML);
};

const applyLanguage = (block, code) => {
  const language = getLanguage(code);

  block.classList.add("line-numbers", `language-${language}`);
  code.classList.add(`language-${language}`);

  return language;
};

const enhanceCodeBlocks = () => {
  const blocks = document.querySelectorAll("pre");

  blocks.forEach((block) => {
    if (block.parentElement?.classList.contains("code-block")) {
      return;
    }

    const code = block.querySelector("code");

    if (!code) {
      return;
    }

    const language = applyLanguage(block, code);

    const wrapper = document.createElement("div");
    wrapper.className = "code-block";

    const toolbar = document.createElement("div");
    toolbar.className = "code-block-toolbar";

    const chrome = document.createElement("div");
    chrome.className = "code-block-chrome";
    chrome.setAttribute("aria-hidden", "true");

    for (let index = 0; index < 3; index += 1) {
      const dot = document.createElement("span");
      dot.className = "code-block-dot";
      chrome.append(dot);
    }

    const label = document.createElement("span");
    label.className = "code-block-label";
    label.textContent = LANGUAGE_LABELS[language] ?? language;

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "code-copy-button";
    copyButton.textContent = "Copy";

    copyButton.addEventListener("click", async () => {
      const source = code.textContent ?? "";

      try {
        await copyText(source);
        wrapper.dataset.copyState = "success";
        copyButton.textContent = "Copied";
      } catch (error) {
        wrapper.dataset.copyState = "error";
        copyButton.textContent = "Retry";
      }

      window.setTimeout(() => {
        wrapper.dataset.copyState = "idle";
        copyButton.textContent = "Copy";
      }, 1800);
    });

    toolbar.append(chrome, label, copyButton);
    block.parentNode.insertBefore(wrapper, block);
    wrapper.append(toolbar, block);
  });
};

const activatePrism = async () => {
  window.Prism = window.Prism || {};
  window.Prism.manual = true;

  try {
    await Promise.all([
      loadStylesheet(`${PRISM_BASE}/themes/prism-tomorrow.min.css`),
      loadStylesheet(`${PRISM_BASE}/plugins/line-numbers/prism-line-numbers.min.css`),
    ]);

    await loadScript(`${PRISM_BASE}/components/prism-core.min.js`);
    await loadScript(`${PRISM_BASE}/plugins/autoloader/prism-autoloader.min.js`);
    await loadScript(`${PRISM_BASE}/plugins/line-numbers/prism-line-numbers.min.js`);

    if (window.Prism?.plugins?.autoloader) {
      window.Prism.plugins.autoloader.languages_path = `${PRISM_BASE}/components/`;
    }

    window.Prism?.highlightAllUnder?.(document);
  } catch (error) {
    document.documentElement.dataset.prismStatus = "error";
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const yearTargets = document.querySelectorAll("[data-current-year]");
  const year = new Date().getFullYear();

  yearTargets.forEach((target) => {
    target.textContent = String(year);
  });

  enhanceCodeBlocks();
  activatePrism();
});
