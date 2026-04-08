// ---------- Main ----------
try {
  const data = await loadData()

  if (config.runsInWidget) {
    Script.setWidget(makeWidget(data))
    Script.complete()
  } else {
    const input = parseShortcutInput()
    if (input) {
      await handleShortcut(data, input)
      Script.complete()
    } else {
      await showMenu(data)
      Script.complete()
    }
  }
} catch (error) {
  await presentError(error)
  Script.complete()
}
