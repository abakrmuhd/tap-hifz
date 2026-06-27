function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderGlyphItem(item, index, items, group, options) {
  const className = item.type === "ayah-marker"
    ? options.buildAyahMarkerClass(group?.key, group, item)
    : item.type || "word";
  const typeClass = escapeHtml(className);
  const family = escapeHtml(item.fontFamily || "QCF2001");
  const glyph = escapeHtml(item.glyph || "");
  const markerAttrs = item.type === "ayah-marker" && !options.inert
    ? ` ${options.buildAyahMarkerAttrs(group?.key, group, item)}`
    : "";
  const space = index < items.length - 1 ? '<span class="space"> </span>' : "";
  return `<span class="${typeClass}"${markerAttrs} style="font-family: '${family}'">${glyph}</span>${space}`;
}

function renderGlyphs(glyphs = [], group, options) {
  return glyphs.map((item, index, items) => renderGlyphItem(item, index, items, group, options)).join("");
}

function renderAyahGroup(group, line, options) {
  const attrs = options.inert ? "" : ` ${options.buildAyahAttrs(group.key, group)}`;
  const className = options.buildGroupClass(group.key, group);
  return `<span class="${escapeHtml(className)}"${attrs}>${renderGlyphs(group.items || group.words || [], group, options)}</span>`;
}

function renderLine(line, options) {
  if (line.type === "surah-header") {
    return `<span class="line centered-line">${renderGlyphs(line.glyphs, null, options)}</span>`;
  }

  if (line.type === "basmala") {
    return `<span class="line centered-line">${renderGlyphs(line.glyphs, null, options)}</span>`;
  }

  const centered = line.centered ? " centered-line" : "";
  const justify = line.justify ? " justify" : "";
  const groups = (line.ayahGroups || []).map((group) => renderAyahGroup(group, line, options)).join("");
  return `<span class="line${centered}${justify}">${groups}</span>`;
}

export function renderQcf4Page(pageData, options) {
  const normalizedOptions = {
    inert: false,
    buildAyahAttrs: () => "",
    buildAyahMarkerAttrs: () => "",
    buildAyahMarkerClass: () => "ayah-marker",
    buildGroupClass: () => "ayah-group",
    ...options
  };
  const lines = (pageData.lines || []).map((line) => renderLine(line, normalizedOptions)).join("");

  return `
    <mushaf-page data-page="${escapeHtml(pageData.page)}" data-page-face="${escapeHtml(pageData.face || "")}">
      <mushaf-page-inner>
        <div class="page-content">
          <div class="ayah-chars">${lines}</div>
        </div>
      </mushaf-page-inner>
    </mushaf-page>
  `;
}
