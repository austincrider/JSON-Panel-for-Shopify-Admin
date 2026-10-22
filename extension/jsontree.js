// Renders a JSON value as a collapsible tree.
// Click a key to copy its path (e.g. product.variants[0].sku).
// Click a value to copy the value.
// Each row also has a copy button: values copy the value, objects and
// arrays copy that section as formatted JSON.
(function (root) {
  const DEFAULT_OPEN_DEPTH = 2;

  function pathJoin(parent, key, isIndex) {
    if (isIndex) return `${parent}[${key}]`;
    const safe = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
    if (!parent) return safe ? key : `["${key}"]`;
    return safe ? `${parent}.${key}` : `${parent}["${key}"]`;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  const SVG_NS = "http://www.w3.org/2000/svg";

  // Two overlapping rectangles, the common "copy" icon. Built with DOM APIs
  // (no innerHTML) to keep the code simple to review.
  function copyIcon() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "12");
    svg.setAttribute("height", "12");
    svg.setAttribute("aria-hidden", "true");
    const back = document.createElementNS(SVG_NS, "path");
    back.setAttribute("d", "M10.5 2.5h-6a1 1 0 0 0-1 1v7");
    const front = document.createElementNS(SVG_NS, "rect");
    for (const [k, v] of Object.entries({ x: "5.5", y: "5", width: "7.5", height: "8.5", rx: "1" })) {
      front.setAttribute(k, v);
    }
    for (const n of [back, front]) {
      n.setAttribute("fill", "none");
      n.setAttribute("stroke", "currentColor");
      n.setAttribute("stroke-width", "1.4");
      n.setAttribute("stroke-linecap", "round");
      svg.appendChild(n);
    }
    return svg;
  }

  function copyButton(getText, label, title, onCopy) {
    const b = el("button", "copy-btn");
    b.type = "button";
    b.title = title;
    b.setAttribute("aria-label", title);
    b.appendChild(copyIcon());
    b.addEventListener("click", (ev) => {
      // Keep the click from toggling the parent <details>.
      ev.preventDefault();
      ev.stopPropagation();
      onCopy(getText(), label);
    });
    return b;
  }

  function keySpan(key, isIndex, path, onCopy) {
    const k = el("span", isIndex ? "key idx" : "key", isIndex ? String(key) : `"${key}"`);
    k.title = `Click to copy path: ${path}`;
    k.dataset.search = String(key).toLowerCase();
    k.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onCopy(path, "Path copied");
    });
    return k;
  }

  function leafValue(value, onCopy) {
    let cls, text, copyText;
    if (value === null) {
      cls = "null"; text = "null"; copyText = "null";
    } else if (typeof value === "string") {
      cls = "str"; text = JSON.stringify(value); copyText = value;
    } else if (typeof value === "number") {
      cls = "num"; text = String(value); copyText = String(value);
    } else if (typeof value === "boolean") {
      cls = "bool"; text = String(value); copyText = String(value);
    } else if (Array.isArray(value)) {
      cls = "empty"; text = "[]"; copyText = "[]";
    } else {
      cls = "empty"; text = "{}"; copyText = "{}";
    }
    const v = el("span", `val ${cls}`, text);
    v.title = "Click to copy value";
    v.dataset.search = String(copyText).toLowerCase();
    v.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onCopy(copyText, "Value copied");
    });
    return v;
  }

  // Same text the value click copies (strings without quotes).
  function leafCopyText(value) {
    if (value === null) return "null";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return "[]";
    if (typeof value === "object") return "{}";
    return String(value);
  }

  function isBranch(value) {
    return value !== null && typeof value === "object" && Object.keys(value).length > 0;
  }

  function buildNode(key, value, path, depth, isIndex, onCopy) {
    const hasKey = key !== null;

    if (!isBranch(value)) {
      const row = el("div", "leaf");
      if (hasKey) {
        row.appendChild(keySpan(key, isIndex, path, onCopy));
        row.appendChild(el("span", "colon", ": "));
      }
      row.appendChild(leafValue(value, onCopy));
      row.appendChild(
        copyButton(() => leafCopyText(value), "Value copied", "Copy value", onCopy)
      );
      return row;
    }

    const arr = Array.isArray(value);
    const entries = arr ? value.map((v, i) => [i, v]) : Object.entries(value);
    const det = el("details", "branch");
    if (depth < DEFAULT_OPEN_DEPTH) det.open = true;

    const sum = el("summary");
    if (hasKey) {
      sum.appendChild(keySpan(key, isIndex, path, onCopy));
      sum.appendChild(el("span", "colon", ": "));
    }
    sum.appendChild(el("span", "brace", arr ? "[" : "{"));
    const n = entries.length;
    sum.appendChild(
      el("span", "count", arr ? `${n} item${n === 1 ? "" : "s"}` : `${n} key${n === 1 ? "" : "s"}`)
    );
    sum.appendChild(el("span", "brace close-inline", arr ? "]" : "}"));
    sum.appendChild(
      copyButton(
        () => JSON.stringify(value, null, 2),
        arr ? "Array copied" : "Object copied",
        arr ? "Copy this array as JSON" : "Copy this object as JSON",
        onCopy
      )
    );
    det.appendChild(sum);

    const kids = el("div", "children");
    for (const [k, v] of entries) {
      const childPath = pathJoin(path, String(k), arr);
      kids.appendChild(buildNode(k, v, childPath, depth + 1, arr, onCopy));
    }
    det.appendChild(kids);
    return det;
  }

  function renderTree(container, data, onCopy) {
    container.textContent = "";
    container.appendChild(buildNode(null, data, "", 0, false, onCopy));
  }

  function setAllOpen(container, open) {
    container.querySelectorAll("details.branch").forEach((d) => (d.open = open));
  }

  // Filters the tree to rows whose key or value contains the term.
  // Returns the number of matching rows.
  function filterTree(container, term) {
    const t = term.trim().toLowerCase();
    container.querySelectorAll(".hidden, .hit").forEach((e) => e.classList.remove("hidden", "hit"));
    if (!t) return -1;

    let hits = 0;

    function matches(row) {
      // Only check the key/value directly in this row, not descendants.
      const parts = row.matches("details")
        ? row.querySelector(":scope > summary").querySelectorAll(":scope > [data-search]")
        : row.querySelectorAll(":scope > [data-search]");
      for (const p of parts) if (p.dataset.search.includes(t)) return true;
      return false;
    }

    function walk(node) {
      if (node.matches("div.leaf")) {
        const m = matches(node);
        if (m) { node.classList.add("hit"); hits++; } else node.classList.add("hidden");
        return m;
      }
      // details.branch
      const selfMatch = matches(node);
      let childMatch = false;
      const kids = node.querySelector(":scope > .children").children;
      for (const c of kids) if (walk(c)) childMatch = true;
      if (selfMatch) {
        node.querySelector(":scope > summary").classList.add("hit");
        hits++;
        // Show the whole matching subtree.
        node.querySelectorAll(".hidden").forEach((e) => e.classList.remove("hidden"));
      }
      if (selfMatch || childMatch) {
        if (childMatch) node.open = true;
        return true;
      }
      node.classList.add("hidden");
      return false;
    }

    const rootNode = container.firstElementChild;
    if (rootNode) {
      if (rootNode.matches("details.branch")) {
        rootNode.open = true;
        for (const c of rootNode.querySelector(":scope > .children").children) walk(c);
      } else {
        walk(rootNode);
      }
    }
    return hits;
  }

  root.JsonTree = { renderTree, setAllOpen, filterTree, pathJoin };
})(typeof self !== "undefined" ? self : globalThis);
