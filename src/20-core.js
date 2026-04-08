// ---------- Widget UI ----------
function widgetModeFromArgs() {
  const raw = normalizeText(args.widgetParameter || "")
  if (!raw) return "top"
  const mode = raw.toLowerCase()
  if (mode === "next" || mode === "today" || mode === "top") return mode
  return "top"
}

function makeWidget(data) {
  const now = new Date()
  const rows = summaryRows(data).slice(0, 3)
  const mode = widgetModeFromArgs()

  const w = new ListWidget()
  const gradient = new LinearGradient()
  gradient.colors = [new Color("#081326"), new Color("#121a2e")]
  gradient.locations = [0, 1]
  w.backgroundGradient = gradient
  w.setPadding(14, 14, 14, 14)

  const title = w.addText(APP_NAME)
  title.textColor = Color.white()
  title.font = Font.boldSystemFont(16)

  const subtitle = w.addText("Approximate tracking dashboard")
  subtitle.textColor = new Color("#9FB1CC")
  subtitle.font = Font.systemFont(10)
  w.addSpacer(8)

  if (mode === "today") {
    const todayCutoff = new Date(now.getTime() - 86400000)
    const recent = data.injections
      .filter(function(injection) {
        const at = dt(injection.time)
        return isValidDate(at) && at >= todayCutoff
      })
      .slice(-3)

    const heading = w.addText("Last 24 hours")
    heading.textColor = Color.white()
    heading.font = Font.semiboldSystemFont(12)
    w.addSpacer(4)

    if (!recent.length) {
      const emptyToday = w.addText("No injections logged in the last day")
      emptyToday.textColor = new Color("#CBD5E1")
      emptyToday.font = Font.systemFont(11)
    } else {
      for (const injection of recent.reverse()) {
        const compound = data.compounds[injection.compound] || {}
        const item = w.addText(`${compound.display_name || injection.compound} ${Number(injection.dose_mg).toFixed(2)} mg`)
        item.textColor = new Color("#DCE7F5")
        item.font = Font.systemFont(11)
      }
    }

    w.addSpacer(8)
    const footerToday = w.addText(formatDateTime(now))
    footerToday.textColor = new Color("#64748B")
    footerToday.font = Font.systemFont(9)
    return w
  }

  if (mode === "next") {
    const upcoming = summaryRows(data)
      .map(function(row) {
        return row.next ? { row: row, nextAt: dt(row.next.time) } : null
      })
      .filter(function(value) { return value && isValidDate(value.nextAt) })
      .sort(function(a, b) { return a.nextAt - b.nextAt })
      .slice(0, 3)

    const heading = w.addText("Next scheduled doses")
    heading.textColor = Color.white()
    heading.font = Font.semiboldSystemFont(12)
    w.addSpacer(4)

    if (!upcoming.length) {
      const emptyNext = w.addText("No enabled schedules")
      emptyNext.textColor = new Color("#CBD5E1")
      emptyNext.font = Font.systemFont(11)
    } else {
      for (const item of upcoming) {
        const line = w.addText(`${item.row.display_name} ${formatRelativeTime(item.nextAt, now)}`)
        line.textColor = new Color(item.row.color)
        line.font = Font.systemFont(11)
      }
    }

    w.addSpacer(8)
    const footerNext = w.addText(formatDateTime(now))
    footerNext.textColor = new Color("#64748B")
    footerNext.font = Font.systemFont(9)
    return w
  }

  if (!rows.length) {
    const empty = w.addText("No injections logged yet")
    empty.textColor = new Color("#CBD5E1")
    empty.font = Font.systemFont(12)

    const tip = w.addText("Use the Log Injection shortcut to get started")
    tip.textColor = new Color("#94A3B8")
    tip.font = Font.systemFont(10)
    return w
  }

  for (const row of rows) {
    const stack = w.addStack()
    stack.layoutVertically()

    const line1 = stack.addStack()
    const dot = line1.addText("● ")
    dot.textColor = new Color(row.color)
    dot.font = Font.boldSystemFont(12)

    const name = line1.addText(row.display_name)
    name.textColor = Color.white()
    name.font = Font.semiboldSystemFont(12)

    const amounts = stack.addText(`${row.amount.toFixed(2)} mg • ${row.concentration.toFixed(3)} mg/L`)
    amounts.textColor = new Color("#CBD5E1")
    amounts.font = Font.systemFont(11)

    const quality = stack.addText(row.quality_label)
    quality.textColor = row.quality_badge === "good" ? new Color("#86EFAC") : (row.quality_badge === "low" ? new Color("#FCA5A5") : new Color("#FDE68A"))
    quality.font = Font.systemFont(10)

    if (row.next) {
      const when = dt(row.next.time)
      const next = stack.addText(`Next ${formatRelativeTime(when, now)} (${formatShortDateTime(when)})`)
      next.textColor = new Color("#94A3B8")
      next.font = Font.systemFont(10)
    }

    w.addSpacer(6)
  }

  const footer = w.addText(formatDateTime(now))
  footer.textColor = new Color("#64748B")
  footer.font = Font.systemFont(9)
  return w
}
