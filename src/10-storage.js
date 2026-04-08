// ---------- Compound + event model ----------
    function compoundNames(data) {
      return Object.keys(data.compounds)
    }

    function activeCompoundNames(data) {
      const seen = {}
      for (const injection of data.injections) seen[injection.compound] = true
      for (const protocol of data.protocols) {
        if (protocol.enabled !== false) seen[protocol.compound] = true
      }
      const names = Object.keys(seen)
      return names.length ? names : compoundNames(data)
    }

    function normalizeCompoundKey(data, value, category) {
      if (!value) return null
      const needle = String(value).trim().toLowerCase()
      const wantedCategory = normalizeCategoryName(category || "")
      if (!needle) return null

      const names = compoundNames(data)
      for (const name of names) {
        if (name.toLowerCase() === needle) return name
      }

      if (wantedCategory && needle.indexOf("::") === -1) {
        const candidate = makeCompoundId(wantedCategory, normalizeCategoryName(needle))
        if (data.compounds[candidate]) return candidate
      }

      return null
    }

    function eventAmountAtTime(event, t, compound) {
      const eventTime = dt(event.time)
      if (!isValidDate(eventTime) || eventTime > t) return 0
      const halfLifeDays = Math.max(0.001, toNumber(compound.half_life_days, 1))
      const elimination = Math.log(2) / halfLifeDays
      const dose = toNumber(event.dose_mg, 0)
      const f = Math.max(0, toNumber(compound.bioavailability, 1))
      const ageDays = daysBetween(eventTime, t)
      return dose * f * Math.exp(-elimination * ageDays)
    }

    function loggedEventsForCompound(data, compoundName, fromTime, toTime) {
      return data.injections
        .filter(function(injection) {
          if (injection.compound !== compoundName) return false
          const at = dt(injection.time)
          if (!isValidDate(at)) return false
          if (fromTime && at < fromTime) return false
          if (toTime && at > toTime) return false
          return toNumber(injection.dose_mg, 0) > 0
        })
        .map(function(injection) {
          return {
            compound: compoundName,
            dose_mg: toNumber(injection.dose_mg, 0),
            time: injection.time,
            source: "log"
          }
        })
    }

    function generateProtocolEvents(data, compoundName, fromTime, toTime, options) {
      const events = []
      const now = new Date()
      const includePast = options && typeof options.includePast === "boolean" ? options.includePast : true
      const includeFuture = options && typeof options.includeFuture === "boolean" ? options.includeFuture : true
      let globalCount = 0

      for (const protocol of data.protocols) {
        if (globalCount >= MAX_PROTOCOL_EVENTS) break
        if (protocol.enabled === false || protocol.compound !== compoundName) continue

        const start = dt(protocol.start)
        const stepDays = Math.max(0.25, toNumber(protocol.every_days, 7))
        const stepMs = stepDays * 86400000
        const dose = toNumber(protocol.dose_mg, 0)
        const occurrences = protocol.occurrences != null ? Math.max(0, toNumber(protocol.occurrences, 0)) : null
        const until = protocol.until ? dt(protocol.until) : null

        if (!isValidDate(start) || !(dose > 0)) continue

        const windowStart = isValidDate(fromTime) ? fromTime : start
        const windowEnd = isValidDate(toTime) ? toTime : new Date(now.getTime() + 365 * 86400000)

        let count = 0
        let t = new Date(start)

        if (windowStart > start) {
          const skipped = Math.floor((windowStart.getTime() - start.getTime()) / stepMs)
          if (skipped > 0) {
            count = skipped
            t = new Date(start.getTime() + skipped * stepMs)
          }

          while (t < windowStart) {
            t = new Date(t.getTime() + stepMs)
            count += 1
          }
        }

        while (true) {
          if (globalCount >= MAX_PROTOCOL_EVENTS) break
          if (occurrences != null && count >= occurrences) break
          if (until && isValidDate(until) && t > until) break
          if (t > windowEnd) break

          const isPast = t < now
          if ((isPast && includePast) || (!isPast && includeFuture)) {
            events.push({
              compound: compoundName,
              dose_mg: dose,
              time: iso(t),
              source: "protocol"
            })
            globalCount += 1
          }

          t = new Date(t.getTime() + stepMs)
          count += 1
        }
      }

      return events.sort(function(a, b) { return dt(a.time) - dt(b.time) })
    }

    function allEventsForCompound(data, compoundName, fromTime, toTime, options) {
      const logged = loggedEventsForCompound(data, compoundName, fromTime, toTime)
      const protocol = options && options.includeProtocols
        ? generateProtocolEvents(data, compoundName, fromTime, toTime, options.protocolOptions || {})
        : []
      return logged
        .concat(protocol)
        .sort(function(a, b) { return dt(a.time) - dt(b.time) })
    }

    function amountForCompoundAt(data, compoundName, t, options) {
      const compound = data.compounds[compoundName]
      if (!compound) return 0

      const halfLifeDays = Math.max(0.001, toNumber(compound.half_life_days, 1))
      const adaptiveLookbackDays = Math.min(3650, Math.max(HISTORY_LOOKBACK_DAYS, halfLifeDays * 20))
      const horizonStart = new Date(t.getTime() - adaptiveLookbackDays * 86400000)
      const events = allEventsForCompound(data, compoundName, horizonStart, t, options || {})
      let total = 0
      for (const event of events) total += eventAmountAtTime(event, t, compound)
      return total
    }

    function concentrationForCompoundAt(data, compoundName, t, options) {
      const compound = data.compounds[compoundName]
      if (!compound) return null
      const vd = Math.max(0.001, toNumber(compound.vd_l, 10))
      return amountForCompoundAt(data, compoundName, t, options) / vd
    }

    function nextScheduledDose(data, compoundName, fromTime) {
      const oneYearOut = new Date(fromTime.getTime() + 365 * 86400000)
      const future = generateProtocolEvents(data, compoundName, fromTime, oneYearOut, {
        includePast: false,
        includeFuture: true
      })
      return future.length ? future[0] : null
    }

    function confidenceMeta(quality) {
      return MODEL_CONFIDENCE[quality] || MODEL_CONFIDENCE.rough
    }

    function protocolOptionsForTime(referenceNow, evaluationTime) {
      const now = isValidDate(referenceNow) ? referenceNow : new Date()
      const evalTime = isValidDate(evaluationTime) ? evaluationTime : now
      return {
        includePast: true,
        includeFuture: evalTime > now
      }
    }

    function summaryRows(data) {
      const now = new Date()
      const names = activeCompoundNames(data)
      const rows = []
      const protocolOptions = protocolOptionsForTime(now, now)

      for (const name of names) {
        const compound = data.compounds[name]
        if (!compound) continue

        const amount = amountForCompoundAt(data, name, now, {
          includeProtocols: true,
          protocolOptions: protocolOptions
        })
        const concentration = concentrationForCompoundAt(data, name, now, {
          includeProtocols: true,
          protocolOptions: protocolOptions
        })
        const nextDose = nextScheduledDose(data, name, now)
        const lastDose = data.injections
          .filter(function(injection) { return injection.compound === name })
          .sort(function(a, b) { return dt(b.time) - dt(a.time) })[0] || null
        const confidence = confidenceMeta(compound.model_quality)

        rows.push({
          name: name,
          display_name: compound.display_name || titleCase(name),
          category: compound.category || DEFAULT_CATEGORY,
          color: compound.color,
          quality: compound.model_quality,
          quality_label: confidence.label,
          quality_badge: confidence.badge,
          route: compound.route || "unknown",
          amount: amount,
          concentration: concentration,
          last: lastDose,
          next: nextDose
        })
      }

      rows.sort(function(a, b) { return b.amount - a.amount })
      return rows
    }

    function buildSeries(data, selectedCompounds, daysBack, daysForward, mode) {
      const now = new Date()
      const start = new Date(now.getTime() - daysBack * 86400000)
      const end = new Date(now.getTime() + daysForward * 86400000)
      const spanDays = daysBack + daysForward
      let stepHours = 6
      if (spanDays <= 3) stepHours = 0.25
      else if (spanDays <= 14) stepHours = 0.5
      else if (spanDays <= 45) stepHours = 1
      else if (spanDays <= 120) stepHours = 3
      else if (spanDays <= 360) stepHours = 6
      else stepHours = 12
      const stepMs = stepHours * 3600000

      const dataset = {
        mode: mode,
        start: iso(start),
        end: iso(end),
        now: iso(now),
        compounds: []
      }

      for (const name of selectedCompounds) {
        const compound = data.compounds[name]
        if (!compound) continue

        const points = []
        for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
          const time = new Date(t)
          const protocolOptions = protocolOptionsForTime(now, time)
          let value = 0
          if (mode === "concentration") {
            value = concentrationForCompoundAt(data, name, time, {
              includeProtocols: true,
              protocolOptions: protocolOptions
            })
          } else {
            value = amountForCompoundAt(data, name, time, {
              includeProtocols: true,
              protocolOptions: protocolOptions
            })
          }
          points.push([iso(time), Number(Math.max(0, value || 0).toFixed(6))])
        }

        const markers = allEventsForCompound(data, name, start, end, {
          includeProtocols: true,
          protocolOptions: { includePast: true, includeFuture: true }
        })
          .map(function(event) {
            return [event.time, event.dose_mg, event.source]
          })

        dataset.compounds.push({
          name: name,
          display_name: compound.display_name || titleCase(name),
          color: compound.color,
          model_quality: compound.model_quality,
          route: compound.route,
          category: compound.category || DEFAULT_CATEGORY,
          points: points,
          markers: markers
        })
      }

      return dataset
    }

    function pushMergedInjection(data, compoundName, dose, timeIso, notes, source) {
      const compound = data.compounds[compoundName]
      data.injections.push({
        id: makeId("inj"),
        compound: compoundName,
        dose_mg: dose,
        time: timeIso,
        source: source || "log",
        notes: notes || "",
        category: compound.category,
        source_file: compound.source_file
      })
      data.injections.sort(function(a, b) { return dt(a.time) - dt(b.time) })
    }

    function pushMergedProtocol(data, compoundName, protocol) {
      const compound = data.compounds[compoundName]
      data.protocols.push({
        id: protocol.id,
        compound: compoundName,
        start: protocol.start,
        dose_mg: protocol.dose_mg,
        every_days: protocol.every_days,
        occurrences: protocol.occurrences,
        until: protocol.until,
        enabled: protocol.enabled,
        notes: protocol.notes || "",
        category: compound.category,
        source_file: compound.source_file
      })
      data.protocols.sort(function(a, b) { return dt(a.start) - dt(b.start) })
    }

    function addInjection(data, compoundName, doseMg, timeValue, notes) {
      const compound = data.compounds[compoundName]
      if (!compound) throw new Error("Unknown compound: " + compoundName)
      const dose = toNumber(doseMg, NaN)
      if (!Number.isFinite(dose) || dose <= 0) throw new Error("Dose must be a positive number")

      const time = new Date(timeValue || new Date())
      if (!isValidDate(time)) throw new Error("Invalid time")

      const fileState = data.__files[compound.source_file]
      if (!fileState) throw new Error("Unable to resolve history file for compound")

      fileState.history.injections.push({
        id: makeId("inj"),
        compound: compound.base_key,
        dose_mg: dose,
        time: iso(time),
        source: "log",
        notes: notes || ""
      })
      fileState.history.injections.sort(function(a, b) { return dt(a.time) - dt(b.time) })
      saveHistoryFile(compound.source_file, fileState.history)

      pushMergedInjection(data, compoundName, dose, iso(time), notes, "log")
    }

    function protocolHistoryRecord(compound, id, dose, start, everyDays, occurrences, until, enabled, notes) {
      return {
        id: id,
        compound: compound.base_key,
        dose_mg: dose,
        start: iso(start),
        every_days: everyDays,
        occurrences: occurrences,
        until: until && isValidDate(until) ? iso(until) : null,
        enabled: enabled !== false,
        notes: notes || ""
      }
    }

    function updateInjectionEntry(data, injectionId, compoundName, doseMg, timeValue, notes) {
      const id = String(injectionId || "").trim()
      if (!id) throw new Error("Missing injection id")

      const injectionIndex = data.injections.findIndex(function(injection) {
        return String(injection.id || "") === id
      })
      if (injectionIndex < 0) throw new Error("Injection not found: " + id)

      const existing = data.injections[injectionIndex]
      const existingCompound = data.compounds[existing.compound]
      const compound = data.compounds[compoundName]
      if (!compound) throw new Error("Unknown compound: " + compoundName)

      const dose = toNumber(doseMg, NaN)
      if (!Number.isFinite(dose) || dose <= 0) throw new Error("Dose must be a positive number")

      const time = new Date(timeValue || existing.time)
      if (!isValidDate(time)) throw new Error("Invalid time")

      const sourceFileName = existing.source_file || (existingCompound ? existingCompound.source_file : compound.source_file)
      const targetFileName = compound.source_file
      const sourceFileState = data.__files[sourceFileName]
      const targetFileState = data.__files[targetFileName]
      if (!sourceFileState || !targetFileState) throw new Error("Unable to resolve history file for injection update")

      const sourceIndex = sourceFileState.history.injections.findIndex(function(injection) {
        return String(injection.id || "") === id
      })
      if (sourceIndex < 0) throw new Error("Injection not found in history file: " + id)

      const updatedHistoryRecord = {
        id: id,
        compound: compound.base_key,
        dose_mg: dose,
        time: iso(time),
        source: existing.source || "log",
        notes: notes || ""
      }

      if (sourceFileName === targetFileName) {
        sourceFileState.history.injections[sourceIndex] = updatedHistoryRecord
        sourceFileState.history.injections.sort(function(a, b) { return dt(a.time) - dt(b.time) })
        saveHistoryFile(sourceFileName, sourceFileState.history)
      } else {
        sourceFileState.history.injections.splice(sourceIndex, 1)
        targetFileState.history.injections.push(updatedHistoryRecord)

        sourceFileState.history.injections.sort(function(a, b) { return dt(a.time) - dt(b.time) })
        targetFileState.history.injections.sort(function(a, b) { return dt(a.time) - dt(b.time) })

        saveHistoryFile(sourceFileName, sourceFileState.history)
        saveHistoryFile(targetFileName, targetFileState.history)
      }

      data.injections[injectionIndex] = {
        id: id,
        compound: compoundName,
        dose_mg: dose,
        time: iso(time),
        source: existing.source || "log",
        notes: notes || "",
        category: compound.category,
        source_file: targetFileName
      }
      data.injections.sort(function(a, b) { return dt(a.time) - dt(b.time) })
    }

    function removeInjectionEntry(data, injectionId) {
      const id = String(injectionId || "").trim()
      if (!id) throw new Error("Missing injection id")

      const injectionIndex = data.injections.findIndex(function(injection) {
        return String(injection.id || "") === id
      })
      if (injectionIndex < 0) throw new Error("Injection not found: " + id)

      const existing = data.injections[injectionIndex]
      const existingCompound = data.compounds[existing.compound]
      const fallbackFile = existingCompound ? existingCompound.source_file : null
      const expectedFile = existing.source_file || fallbackFile

      let sourceFileName = null
      if (expectedFile && data.__files[expectedFile]) {
        const directIndex = data.__files[expectedFile].history.injections.findIndex(function(injection) {
          return String(injection.id || "") === id
        })
        if (directIndex >= 0) sourceFileName = expectedFile
      }

      if (!sourceFileName) {
        const fileNames = Object.keys(data.__files)
        for (const fileName of fileNames) {
          const state = data.__files[fileName]
          const idx = state.history.injections.findIndex(function(injection) {
            return String(injection.id || "") === id
          })
          if (idx >= 0) {
            sourceFileName = fileName
            break
          }
        }
      }

      if (!sourceFileName) throw new Error("Injection not found in history files: " + id)

      const sourceFileState = data.__files[sourceFileName]
      const sourceIndex = sourceFileState.history.injections.findIndex(function(injection) {
        return String(injection.id || "") === id
      })
      if (sourceIndex < 0) throw new Error("Injection not found in history file: " + id)

      sourceFileState.history.injections.splice(sourceIndex, 1)
      sourceFileState.history.injections.sort(function(a, b) { return dt(a.time) - dt(b.time) })
      saveHistoryFile(sourceFileName, sourceFileState.history)

      data.injections.splice(injectionIndex, 1)
      data.injections.sort(function(a, b) { return dt(a.time) - dt(b.time) })

      return {
        id: id,
        source_file: sourceFileName,
        compound: existing.compound
      }
    }

    function addProtocolEntry(data, entry) {
      const compoundName = normalizeCompoundKey(data, entry.compound, entry.category)
      if (!compoundName) throw new Error("Unknown compound: " + entry.compound)

      const compound = data.compounds[compoundName]
      const fileState = data.__files[compound.source_file]
      if (!fileState) throw new Error("Unable to resolve history file for compound")

      const start = new Date(entry.start || new Date())
      const dose = toNumber(entry.dose_mg != null ? entry.dose_mg : entry.dose, NaN)
      const everyDays = toNumber(entry.every_days, 7)
      if (!isValidDate(start) || !Number.isFinite(dose) || dose <= 0 || !Number.isFinite(everyDays) || everyDays <= 0) {
        throw new Error("Protocol entry is invalid")
      }

      const occurrences = entry.occurrences != null && entry.occurrences !== ""
        ? Math.max(0, Math.floor(toNumber(entry.occurrences, 0)))
        : null
      const until = entry.until ? new Date(entry.until) : null
      const protocol = protocolHistoryRecord(
        compound,
        makeId("pro"),
        dose,
        start,
        everyDays,
        occurrences,
        until,
        entry.enabled !== false,
        entry.notes || ""
      )

      fileState.history.protocols.push(protocol)
      fileState.history.protocols.sort(function(a, b) { return dt(a.start) - dt(b.start) })
      saveHistoryFile(compound.source_file, fileState.history)

      pushMergedProtocol(data, compoundName, protocol)
    }

    function updateProtocolEntry(data, protocolId, entry) {
      const id = normalizeText(protocolId)
      if (!id) throw new Error("Missing protocol id")

      const protocolIndex = data.protocols.findIndex(function(protocol) {
        return normalizeText(protocol.id) === id
      })
      if (protocolIndex < 0) throw new Error("Protocol not found: " + id)

      const existing = data.protocols[protocolIndex]
      const existingCompound = data.compounds[existing.compound]
      const compoundName = normalizeCompoundKey(data, entry.compound != null ? entry.compound : existing.compound, entry.category || existing.category)
      if (!compoundName) throw new Error("Unknown compound: " + (entry.compound != null ? entry.compound : existing.compound))
      const compound = data.compounds[compoundName]
      const start = new Date(entry.start || existing.start)
      const dose = toNumber(entry.dose_mg != null ? entry.dose_mg : entry.dose != null ? entry.dose : existing.dose_mg, NaN)
      const everyDays = toNumber(entry.every_days != null ? entry.every_days : existing.every_days, NaN)
      const occurrences = entry.occurrences != null && entry.occurrences !== ""
        ? Math.max(0, Math.floor(toNumber(entry.occurrences, 0)))
        : (entry.occurrences === "" ? null : existing.occurrences)
      const until = entry.until ? new Date(entry.until) : (entry.until === "" ? null : (existing.until ? new Date(existing.until) : null))
      const enabled = typeof entry.enabled === "boolean" ? entry.enabled : existing.enabled !== false
      if (!isValidDate(start) || !Number.isFinite(dose) || dose <= 0 || !Number.isFinite(everyDays) || everyDays <= 0) {
        throw new Error("Protocol entry is invalid")
      }

      const sourceFileName = existing.source_file || (existingCompound ? existingCompound.source_file : compound.source_file)
      const targetFileName = compound.source_file
      const sourceFileState = data.__files[sourceFileName]
      const targetFileState = data.__files[targetFileName]
      if (!sourceFileState || !targetFileState) throw new Error("Unable to resolve history file for protocol update")

      const sourceIndex = sourceFileState.history.protocols.findIndex(function(protocol) {
        return normalizeText(protocol.id) === id
      })
      if (sourceIndex < 0) throw new Error("Protocol not found in history file: " + id)

      const updatedHistoryRecord = protocolHistoryRecord(compound, id, dose, start, everyDays, occurrences, until, enabled, entry.notes != null ? entry.notes : existing.notes || "")

      if (sourceFileName === targetFileName) {
        sourceFileState.history.protocols[sourceIndex] = updatedHistoryRecord
        sourceFileState.history.protocols.sort(function(a, b) { return dt(a.start) - dt(b.start) })
        saveHistoryFile(sourceFileName, sourceFileState.history)
      } else {
        sourceFileState.history.protocols.splice(sourceIndex, 1)
        targetFileState.history.protocols.push(updatedHistoryRecord)
        sourceFileState.history.protocols.sort(function(a, b) { return dt(a.start) - dt(b.start) })
        targetFileState.history.protocols.sort(function(a, b) { return dt(a.start) - dt(b.start) })
        saveHistoryFile(sourceFileName, sourceFileState.history)
        saveHistoryFile(targetFileName, targetFileState.history)
      }

      data.protocols[protocolIndex] = {
        id: id,
        compound: compoundName,
        start: updatedHistoryRecord.start,
        dose_mg: updatedHistoryRecord.dose_mg,
        every_days: updatedHistoryRecord.every_days,
        occurrences: updatedHistoryRecord.occurrences,
        until: updatedHistoryRecord.until,
        enabled: updatedHistoryRecord.enabled,
        notes: updatedHistoryRecord.notes,
        category: compound.category,
        source_file: targetFileName
      }
      data.protocols.sort(function(a, b) { return dt(a.start) - dt(b.start) })
    }

    function removeProtocolEntry(data, protocolId) {
      const id = normalizeText(protocolId)
      if (!id) throw new Error("Missing protocol id")
      const protocolIndex = data.protocols.findIndex(function(protocol) {
        return normalizeText(protocol.id) === id
      })
      if (protocolIndex < 0) throw new Error("Protocol not found: " + id)

      const existing = data.protocols[protocolIndex]
      const expectedFile = existing.source_file
      const fileState = expectedFile ? data.__files[expectedFile] : null
      if (!fileState) throw new Error("Unable to resolve history file for protocol delete")

      const sourceIndex = fileState.history.protocols.findIndex(function(protocol) {
        return normalizeText(protocol.id) === id
      })
      if (sourceIndex < 0) throw new Error("Protocol not found in history file: " + id)

      fileState.history.protocols.splice(sourceIndex, 1)
      fileState.history.protocols.sort(function(a, b) { return dt(a.start) - dt(b.start) })
      saveHistoryFile(expectedFile, fileState.history)

      data.protocols.splice(protocolIndex, 1)
      data.protocols.sort(function(a, b) { return dt(a.start) - dt(b.start) })
      return existing
    }

    function toggleProtocolEntry(data, protocolId, enabled) {
      updateProtocolEntry(data, protocolId, { enabled: enabled })
    }
