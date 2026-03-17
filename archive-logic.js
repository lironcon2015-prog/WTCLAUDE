/**
 * GYMPRO ELITE - ARCHIVE & ANALYTICS
 * Version: 14.0.0 (Phase 4 & 5: Analytics Engine & Dashboard Configurations)
 * Includes: Finish Workout, Archive View, Calendar, Import/Export, Macro/Micro Analytics.
 */

function finish() {
    haptic('success');
    StorageManager.clearSessionState(); 
    state.workoutDurationMins = Math.floor((Date.now() - state.workoutStartTime) / 60000);
    navigate('ui-summary');
    document.getElementById('summary-note').value = "";
    
    // --- 1. DATA PROCESSING ---
    let grouped = {};
    state.log.forEach(e => {
        if (!grouped[e.exName]) grouped[e.exName] = { sets:[], vol: 0, hasWarmup: false };
        if (e.isWarmup) grouped[e.exName].hasWarmup = true;
        else if (!e.skip) {
            let weightStr = `${e.w}kg`;
            if (isUnilateral(e.exName)) weightStr += ` (יד אחת)`;
            
            let setStr = `${weightStr} x ${e.r} (RIR ${e.rir})`;
            if (e.note) setStr += ` | Note: ${e.note}`;
            grouped[e.exName].sets.push(setStr); 
            grouped[e.exName].vol += (e.w * e.r);
        }
    });
    
    state.lastWorkoutDetails = grouped;

    // --- 2. DUAL GENERATION (Raw Text & Visual HTML) ---
    const workoutDisplayName = state.type; 
    const dateStr = new Date().toLocaleDateString('he-IL');
    
    // Raw String for Clipboard
    let summaryText = `GYMPRO ELITE SUMMARY\n${workoutDisplayName} | Week ${state.week} | ${dateStr} | ${state.workoutDurationMins}m\n\n`;

    // Visual HTML for Screen (No Icons, Typography Focused)
    let html = `
    <div class="summary-overview-card">
        <div class="summary-overview-col">
            <span class="summary-overview-val">${workoutDisplayName}</span>
            <span class="summary-overview-label">תוכנית</span>
        </div>
        <div class="summary-overview-col">
            <span class="summary-overview-val">${state.week}</span>
            <span class="summary-overview-label">שבוע</span>
        </div>
        <div class="summary-overview-col">
            <span class="summary-overview-val">${state.workoutDurationMins}m</span>
            <span class="summary-overview-label">זמן</span>
        </div>
        <div class="summary-overview-col">
            <span class="summary-overview-val">${dateStr}</span>
            <span class="summary-overview-label">תאריך</span>
        </div>
    </div>`;

    let processedIndices = new Set();
    let lastClusterRound = 0;

    // Single chronological loop building both outputs
    state.log.forEach((entry, index) => {
        if (processedIndices.has(index)) return; 
        if (entry.isWarmup) return; 

        if (entry.isCluster) {
            // Cluster Card Handling
            if (entry.round && entry.round !== lastClusterRound) {
                summaryText += `\n--- Cluster Round ${entry.round} ---\n`;
                html += `<div class="summary-cluster-round">סבב ${entry.round}</div>`;
                lastClusterRound = entry.round;
            }
            
            html += `<div class="summary-ex-card"><div class="summary-ex-header"><span class="summary-ex-title">${entry.exName}</span></div>`;
            
            let details = "";
            if (entry.skip) {
                details = "(Skipped)";
                html += `<div class="summary-tag-skip">דילוג</div>`;
            } else {
                let weightStr = `${entry.w}kg`;
                if (isUnilateral(entry.exName)) weightStr += ` (Uni)`;
                details = `${weightStr} x ${entry.r} (RIR ${entry.rir})`;
                if (entry.note) details += ` | ${entry.note}`;
                
                html += `
                <div class="summary-set-row">
                    <span class="summary-set-num">-</span>
                    <span class="summary-set-details">${weightStr} x ${entry.r} (RIR ${entry.rir})</span>
                </div>`;
                if (entry.note) html += `<div class="summary-set-note">הערה: ${entry.note}</div>`;
            }
            
            summaryText += `• ${entry.exName}: ${details}\n`;
            html += `</div>`;
            processedIndices.add(index);

        } else {
            // Standard Exercise Handling
            lastClusterRound = 0;
            if(grouped[entry.exName]) {
                summaryText += `${entry.exName} (Vol: ${grouped[entry.exName].vol}kg):\n`;
                if (grouped[entry.exName].hasWarmup) summaryText += `🔥 Warmup Completed\n`;
                
                html += `<div class="summary-ex-card">
                    <div class="summary-ex-header">
                        <span class="summary-ex-title">${entry.exName}</span>
                        <span class="summary-ex-vol">[נפח: ${grouped[entry.exName].vol}kg]</span>
                    </div>`;
                    
                if (grouped[entry.exName].hasWarmup) {
                    html += `<div class="summary-tag-warmup">[ סט חימום ]</div>`;
                }

                let setCounter = 1;
                state.log.forEach((subEntry, subIndex) => {
                    if (!processedIndices.has(subIndex) && !subEntry.isCluster && subEntry.exName === entry.exName && !subEntry.isWarmup) {
                        if (subEntry.skip) {
                            summaryText += `(Skipped)\n`;
                            html += `<div class="summary-tag-skip">(דילוג)</div>`;
                        } else {
                            let weightStr = `${subEntry.w}kg`;
                            if (isUnilateral(subEntry.exName)) weightStr += ` (יד אחת)`;
                            let setStr = `${weightStr} x ${subEntry.r} (RIR ${subEntry.rir})`;
                            if (subEntry.note) setStr += ` | Note: ${subEntry.note}`;
                            summaryText += `${setStr}\n`;
                            
                            html += `
                            <div class="summary-set-row">
                                <span class="summary-set-num">${setCounter}.</span>
                                <span class="summary-set-details">${weightStr} x ${subEntry.r} (RIR ${subEntry.rir})</span>
                            </div>`;
                            if (subEntry.note) html += `<div class="summary-set-note">הערה: ${subEntry.note}</div>`;
                            setCounter++;
                        }
                        processedIndices.add(subIndex);
                    }
                });
                summaryText += `\n`; 
                html += `</div>`;
            }
        }
    });

    const summaryArea = document.getElementById('summary-area');
    summaryArea.className = ""; 
    summaryArea.innerHTML = html;
    summaryArea.dataset.rawSummary = summaryText.trim(); 
}

function copyResult() {
    const summaryArea = document.getElementById('summary-area');
    const rawText = summaryArea.dataset.rawSummary;
    
    let textToCopy = rawText;
    const userNote = document.getElementById('summary-note').value.trim();
    if (userNote) textToCopy += `\n\n📝 הערות כלליות: ${userNote}`;
    
    const workoutDisplayName = state.type;
    const dateStr = new Date().toLocaleDateString('he-IL');
    
    const archiveObj = { 
        id: Date.now(), 
        date: dateStr, 
        timestamp: Date.now(), 
        type: workoutDisplayName, 
        week: state.week, 
        duration: state.workoutDurationMins, 
        summary: textToCopy, 
        details: state.lastWorkoutDetails, 
        generalNote: userNote 
    };
    StorageManager.saveToArchive(archiveObj);
    
    if (navigator.clipboard) { 
        navigator.clipboard.writeText(textToCopy).then(() => { 
            haptic('light'); 
            alert("הסיכום נשמר בארכיון והועתק!"); 
            location.reload(); 
        }); 
    } else { 
        const el = document.createElement("textarea"); 
        el.value = textToCopy; 
        document.body.appendChild(el); 
        el.select(); 
        document.execCommand('copy'); 
        document.body.removeChild(el); 
        alert("הסיכום נשמר בארכיון והועתק!"); 
        location.reload(); 
    }
}

function switchArchiveView(view) {
    state.archiveView = view;
    document.getElementById('btn-view-list').className = `segment-btn ${view === 'list' ? 'active' : ''}`;
    document.getElementById('btn-view-calendar').className = `segment-btn ${view === 'calendar' ? 'active' : ''}`;
    openArchive();
}

function openArchive() {
    if (state.archiveView === 'list') {
        document.getElementById('list-view-container').style.display = 'block';
        document.getElementById('calendar-view').style.display = 'none';
        renderArchiveList();
    } else {
        document.getElementById('list-view-container').style.display = 'none';
        document.getElementById('calendar-view').style.display = 'block';
        state.calendarOffset = 0;
        renderCalendar();
    }
    navigate('ui-archive');
}

let selectedArchiveIds = new Set(); 

function renderArchiveList() {
    const list = document.getElementById('archive-list'); list.innerHTML = "";
    selectedArchiveIds.clear(); updateCopySelectedBtn();
    const history = StorageManager.getArchive();
    
    if (history.length === 0) { 
        list.innerHTML = `<div class="text-center color-dim mt-md">אין אימונים שמורים</div>`; 
    } else {
        history.forEach(item => {
            const card = document.createElement('div'); 
            card.className = "menu-card"; 
            card.style.cursor = "default";
            const weekStr = item.week ? ` • שבוע ${item.week}` : '';
            
            card.innerHTML = `
                <div class="archive-card-row">
                    <input type="checkbox" class="archive-checkbox" data-id="${item.timestamp}">
                    <div class="archive-info">
                        <div class="flex-between w-100">
                            <h3 class="m-0">${item.date}</h3>
                            <span class="text-sm color-dim">${item.duration} דק'</span>
                        </div>
                        <p class="m-0 color-dim text-sm">${item.type}${weekStr}</p>
                    </div>
                    <div class="chevron"></div>
                </div>`;
                
            const checkbox = card.querySelector('.archive-checkbox');
            checkbox.addEventListener('change', (e) => toggleArchiveSelection(parseInt(e.target.dataset.id)));
            checkbox.addEventListener('click', (e) => e.stopPropagation());
            card.addEventListener('click', (e) => { if (e.target !== checkbox) showArchiveDetail(item); });
            list.appendChild(card);
        });
    }
}

function toggleArchiveSelection(id) { if (selectedArchiveIds.has(id)) selectedArchiveIds.delete(id); else selectedArchiveIds.add(id); updateCopySelectedBtn(); }

function updateCopySelectedBtn() {
    const btn = document.getElementById('btn-copy-selected');
    if (selectedArchiveIds.size > 0) { 
        btn.disabled = false; 
        btn.style.opacity = "1"; 
        btn.style.borderColor = "var(--accent)"; 
        btn.style.color = "var(--accent)"; 
    } else { 
        btn.disabled = true; 
        btn.style.opacity = "0.5"; 
        btn.style.borderColor = "var(--border)"; 
        btn.style.color = "var(--text-dim)"; 
    }
}

function copyBulkLog(mode) {
    const history = StorageManager.getArchive();
    let itemsToCopy = mode === 'all' ? history : history.filter(item => selectedArchiveIds.has(item.timestamp));
    if (itemsToCopy.length === 0) { alert("לא נבחרו אימונים להעתקה"); return; }
    const bulkText = itemsToCopy.map(item => item.summary).join("\n\n========================================\n\n");
    if (navigator.clipboard) { navigator.clipboard.writeText(bulkText).then(() => { haptic('success'); alert(`הועתקו ${itemsToCopy.length} אימונים בהצלחה!`); }); } 
    else { const el = document.createElement("textarea"); el.value = bulkText; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); alert(`הועתקו ${itemsToCopy.length} אימונים בהצלחה!`); }
}

function changeMonth(delta) { state.calendarOffset += delta; renderCalendar(); }
function renderCalendar() {
    const grid = document.getElementById('calendar-days');
    grid.innerHTML = "";
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + state.calendarOffset, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const monthNames =["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
    document.getElementById('current-month-display').innerText = `${monthNames[month]} ${year}`;
    const firstDayIndex = targetDate.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const history = StorageManager.getArchive();
    
    const monthWorkouts = history.filter(item => {
        const d = new Date(item.timestamp);
        return d.getMonth() === month && d.getFullYear() === year;
    });
    
    for(let i = 0; i < firstDayIndex; i++) { 
        const cell = document.createElement('div'); 
        cell.className = "calendar-cell empty"; 
        grid.appendChild(cell); 
    }
    
    const today = new Date();
    for(let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div'); cell.className = "calendar-cell";
        cell.innerHTML = `<span>${day}</span>`;
        if(state.calendarOffset === 0 && day === today.getDate()) cell.classList.add('today');
        
        const dailyWorkouts = monthWorkouts.filter(item => new Date(item.timestamp).getDate() === day);
        if(dailyWorkouts.length > 0) {
            const dotsContainer = document.createElement('div'); 
            dotsContainer.className = "dots-container";
            
            dailyWorkouts.forEach(wo => {
                const dot = document.createElement('div');
                let dotClass = 'type-free';
                if(wo.type.includes('כתפיים - גב - חזה') || wo.type.includes('A')) dotClass = 'type-a';
                else if(wo.type.includes('רגליים - גב') || wo.type.includes('B')) dotClass = 'type-b';
                else if(wo.type.includes('חזה - כתפיים') || wo.type.includes('C')) dotClass = 'type-c';
                dot.className = `dot ${dotClass}`;
                dotsContainer.appendChild(dot);
            });
            cell.appendChild(dotsContainer);
            cell.onclick = () => openDayDrawer(dailyWorkouts, day, monthNames[month]);
        }
        grid.appendChild(cell);
    }
}

function openDayDrawer(workouts, day, monthName) {
    const drawer = document.getElementById('sheet-modal');
    const overlay = document.getElementById('sheet-overlay');
    const content = document.getElementById('sheet-content');
    
    let html = `<h3>${day} ב${monthName}</h3>`;
    
    if(workouts.length === 0) { 
        html += `<p class="color-dim text-sm">אין אימונים ביום זה</p>`; 
    } else {
        html += `<p class="color-dim text-sm">נמצאו ${workouts.length} אימונים:</p>`;
        workouts.forEach(wo => {
            let dotColor = '#BF5AF2';
            if(wo.type.includes('כתפיים - גב - חזה') || wo.type.includes('A')) dotColor = '#0A84FF';
            else if(wo.type.includes('רגליים - גב') || wo.type.includes('B')) dotColor = '#32D74B';
            else if(wo.type.includes('חזה - כתפיים') || wo.type.includes('C')) dotColor = '#FF9F0A';
            
            html += `
            <div class="mini-workout-item" onclick='openArchiveFromDrawer(${JSON.stringify(wo).replace(/'/g, "&#39;")})'>
                <div class="mini-dot" style="background:${dotColor}"></div>
                <div style="flex-grow:1;">
                    <div class="font-semi text-base">${wo.type}</div>
                    <div class="text-xs color-dim">${wo.duration} דק' • ${new Date(wo.timestamp).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}</div>
                </div>
                <div class="chevron"></div>
            </div>`;
        });
    }
    content.innerHTML = html;
    overlay.style.display = 'block';
    drawer.classList.add('open');
    haptic('light');
}

function closeDayDrawer() {
    const drawer = document.getElementById('sheet-modal');
    const overlay = document.getElementById('sheet-overlay');
    drawer.classList.remove('open');
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
}

function openArchiveFromDrawer(itemData) {
    closeDayDrawer();
    const realItem = StorageManager.getArchive().find(i => i.timestamp === itemData.timestamp);
    if(realItem) showArchiveDetail(realItem);
}

function showArchiveDetail(item) {
    currentArchiveItem = item; 
    document.getElementById('archive-detail-content').innerText = item.summary;
    document.getElementById('btn-archive-copy').onclick = () => navigator.clipboard.writeText(item.summary).then(() => alert("הועתק!"));
    
    document.getElementById('btn-archive-delete').onclick = () => { 
        if(confirm("למחוק אימון זה מהארכיון?")) { 
            StorageManager.deleteFromArchive(item.timestamp); 
            state.historyStack.pop(); 
            openArchive(); 
        } 
    };
    
    navigate('ui-archive-detail');
}

function exportData() {
    const data = StorageManager.getAllData();
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: "application/json"})); 
    a.download = `gympro_backup_${new Date().toISOString().slice(0,10)}.json`; 
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function triggerImport() { document.getElementById('import-file').click(); }

function importData(input) {
    const file = input.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if(confirm("האם לדרוס את הנתונים הקיימים ולשחזר מהגיבוי?")) { 
                StorageManager.restoreData(data); 
                alert("הנתונים שוחזרו בהצלחה!"); 
                location.reload(); 
            }
        } catch(err) { alert("שגיאה בטעינת הקובץ."); }
    };
    reader.readAsText(file);
}

function triggerConfigImport() { document.getElementById('import-config-file').click(); }

function processConfigImport(input) {
    const file = input.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { 
        try { 
            StorageManager.importConfiguration(JSON.parse(e.target.result)); 
        } catch(err) { 
            alert("שגיאה בטעינת הקובץ."); 
        } 
    };
    reader.readAsText(file);
}

function openSessionLog() {
    const drawer = document.getElementById('sheet-modal');
    const overlay = document.getElementById('sheet-overlay');
    const content = document.getElementById('sheet-content');

    let html = `<h3>יומן אימון נוכחי</h3>`;
    
    if (state.log.length === 0) {
        html += `<p class="text-center mt-lg color-dim">טרם בוצעו סטים באימון זה</p>`;
    } else {
        html += `<div class="vertical-stack mt-sm">`;
        state.log.forEach((entry, index) => {
            const isSkip = entry.skip;
            const isWarmup = entry.isWarmup;
            let displayTitle = entry.exName;
            let details = "";
            let dotColor = "var(--text-dim)";

            if (isSkip) { details = "דילוג על תרגיל"; } 
            else if (isWarmup) { details = "סט חימום"; dotColor = "#ff3b30"; } 
            else { details = `${entry.w}kg x ${entry.r} (RIR ${entry.rir})`; if (entry.note) details += ` | 📝`; dotColor = "var(--accent)"; }

            html += `
            <div class="mini-workout-item" onclick="openEditSet(${index})">
                <div class="mini-dot" style="background:${dotColor}"></div>
                <div style="flex-grow:1;">
                    <div class="font-semi text-sm">${index + 1}. ${displayTitle}</div>
                    <div class="text-sm color-dim mt-xs">${details}</div>
                </div>
                <div class="chevron"></div>
            </div>`;
        });
        html += `</div>`;
    }

    content.innerHTML = html;
    overlay.style.display = 'block';
    drawer.classList.add('open');
    haptic('light');
}

function openHistoryDrawer() {
    const drawer = document.getElementById('sheet-modal');
    const overlay = document.getElementById('sheet-overlay');
    const content = document.getElementById('sheet-content');
    
    const history = getLastPerformance(state.currentExName);
    
    let html = `<h3>היסטוריה: ${state.currentExName}</h3>`;
    
    if (!history) {
        html += `<p class="text-center mt-lg color-dim">אין נתונים מהאימון הקודם</p>`;
    } else {
        html += `<div class="text-sm color-dim mb-md text-right mt-xs">📅 ביצוע אחרון: ${history.date}</div>`;
        
        html += `
        <div class="history-header">
            <div>סט</div>
            <div>משקל</div>
            <div>חזרות</div>
            <div>RIR</div>
        </div>
        <div class="history-list">`;
        
        history.sets.forEach((setStr, idx) => {
            let weight = "-", reps = "-", rir = "-";
            try {
                let coreStr = setStr;
                if (setStr.includes('| Note:')) {
                    coreStr = setStr.split('| Note:')[0].trim();
                }

                const parts = coreStr.split('x');
                if(parts.length > 1) {
                    weight = parts[0].replace('kg', '').trim();
                    const rest = parts[1];
                    const rirMatch = rest.match(/\(RIR (.*?)\)/);
                    reps = rest.split('(')[0].trim();
                    if(rirMatch) rir = rirMatch[1];
                }
            } catch(e) {}

            html += `
            <div class="history-row">
                <div class="history-col set-idx">#${idx + 1}</div>
                <div class="history-col">${weight}</div>
                <div class="history-col">${reps}</div>
                <div class="history-col rir-note">${rir}</div>
            </div>`;
        });
        html += `</div>`;
    }

    content.innerHTML = html;
    overlay.style.display = 'block';
    drawer.classList.add('open');
    haptic('light');
}

function getLastPerformance(exName) {
    const archive = StorageManager.getArchive();
    for (const item of archive) {
        if (item.week === 'deload') continue;
        if (item.details && item.details[exName]) {
            if (item.details[exName].sets && item.details[exName].sets.length > 0) {
                return { date: item.date, sets: item.details[exName].sets };
            }
        }
    }
    return null;
}

function openEditSet(index) {
    const entry = state.log[index];
    if (entry.skip || entry.isWarmup) { alert("לא ניתן לערוך דילוגים או סטים של חימום כרגע."); return; }
    state.editingIndex = index;
    document.getElementById('edit-weight').value = entry.w;
    document.getElementById('edit-reps').value = entry.r;
    document.getElementById('edit-rir').value = entry.rir;
    document.getElementById('edit-note').value = entry.note || "";
    
    document.getElementById('btn-delete-set').style.display = 'block';
    closeDayDrawer(); 
    document.getElementById('edit-set-modal').style.display = 'flex';
}

function closeEditModal() { document.getElementById('edit-set-modal').style.display = 'none'; state.editingIndex = -1; }

function saveSetEdit() {
    if (state.editingIndex === -1) return;
    const w = parseFloat(document.getElementById('edit-weight').value);
    const r = parseInt(document.getElementById('edit-reps').value);
    const rir = document.getElementById('edit-rir').value;
    const note = document.getElementById('edit-note').value;
    if (isNaN(w) || isNaN(r)) { alert("נא להזין ערכים תקינים"); return; }
    
    state.log[state.editingIndex].w = w;
    state.log[state.editingIndex].r = r;
    state.log[state.editingIndex].rir = rir;
    state.log[state.editingIndex].note = note;

    if (state.editingIndex === state.log.length - 1) {
        state.lastLoggedSet = state.log[state.editingIndex];
        const hist = document.getElementById('last-set-info');
        hist.innerText = `סט אחרון: ${state.lastLoggedSet.w}kg x ${state.lastLoggedSet.r} (RIR ${state.lastLoggedSet.rir})`;
    }
    StorageManager.saveSessionState();
    closeEditModal(); haptic('success'); openSessionLog(); 
}

function deleteSetFromLog() {
    if (state.editingIndex === -1) return;
    if (!confirm("האם למחוק את הסט הזה?")) return;
    
    const removedEntry = state.log[state.editingIndex];
    state.log.splice(state.editingIndex, 1);
    
    if (removedEntry.exName === state.currentExName) {
        if (state.setIdx > 0) state.setIdx--;
        const relevantLogs = state.log.filter(l => l.exName === state.currentExName && !l.skip && !l.isWarmup);
        if (relevantLogs.length > 0) {
            state.lastLoggedSet = relevantLogs[relevantLogs.length - 1];
        } else {
            state.lastLoggedSet = null;
        }
    }
    
    StorageManager.saveSessionState();
    closeEditModal();
    haptic('warning');
    
    if (document.getElementById('ui-main').classList.contains('active')) {
        if(typeof initPickers === 'function') initPickers();
    }
    openSessionLog();
}


/* ======================================================================
   PHASE 4 & 5: ANALYTICS ENGINE (MACRO & MICRO DATA)
   ====================================================================== */

function initAnalytics() {
    const history = StorageManager.getArchive();
    const prefs = StorageManager.getAnalyticsPrefs();
    
    // Initial Render Macro
    renderAnalyticsMacro(history, prefs);
    
    // Setup Micro Exercise Selector
    const exSet = new Set();
    history.forEach(wo => {
        if(wo.details) Object.keys(wo.details).forEach(ex => exSet.add(ex));
    });
    
    const sel = document.getElementById('micro-ex-select');
    sel.innerHTML = "";
    Array.from(exSet).sort().forEach(ex => {
        sel.add(new Option(ex, ex));
    });

    if(sel.options.length > 0) loadMicroData();
}

function switchAnalyticsTab(tab, btn) {
    document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.atab').forEach(t => t.classList.remove('active'));
    document.getElementById('at-' + tab).classList.add('active');
    
    if(tab === 'micro') loadMicroData();
    haptic('light');
}

// --- MACRO VIEW ---
function renderAnalyticsMacro(history, prefs) {
    if(history.length === 0) return;

    // 1. Top Metrics
    let totVol = 0, totTime = 0, peakVol = 0;
    history.forEach(wo => {
        let woVol = 0;
        if(wo.details) { Object.values(wo.details).forEach(ex => woVol += (ex.vol || 0)); }
        totVol += woVol;
        totTime += (wo.duration || 0);
        if(woVol > peakVol) peakVol = woVol;
    });

    document.getElementById('m-val-tot-vol').innerText = totVol.toLocaleString();
    document.getElementById('m-sub-tot-vol').innerText = prefs.units;
    document.getElementById('m-val-workouts').innerText = history.length;
    document.getElementById('m-sub-workouts').innerText = "אימונים שבוצעו";
    document.getElementById('m-val-time').innerText = Math.floor(totTime/60) + "h " + (totTime%60) + "m";
    document.getElementById('m-sub-time').innerText = "זמן מצטבר";
    document.getElementById('m-val-peak').innerText = peakVol.toLocaleString();
    document.getElementById('m-sub-peak').innerText = "נפח מרבי";

    // 2. Bar Chart (Volume)
    const limit = prefs.volumeRange || 8;
    const sliced = history.slice(0, limit).reverse();
    const barContainer = document.getElementById('bar-chart-container');
    barContainer.innerHTML = "";
    document.getElementById('vol-chart-ttl').innerText = `התקדמות נפח (${limit} אימונים אחרונים)`;

    let maxV = 0;
    const vols = sliced.map(wo => {
        let v = 0;
        if(wo.details) Object.values(wo.details).forEach(ex => v += (ex.vol || 0));
        if(v > maxV) maxV = v;
        return { date: wo.date.substring(0,5), val: v };
    });

    vols.forEach(item => {
        const hPct = maxV === 0 ? 0 : Math.max(5, (item.val / maxV) * 100);
        const isPeak = item.val === maxV && maxV > 0;
        const col = document.createElement('div');
        col.className = 'bar-col';
        col.innerHTML = `
            <div class="bar-wrap">
                <div class="bar-fill ${isPeak ? 'peak' : ''}" style="height:0%"></div>
                <div class="bar-vl">${item.val >= 1000 ? (item.val/1000).toFixed(1)+'k' : item.val}</div>
            </div>
            <div class="bar-dt">${item.date}</div>
        `;
        barContainer.appendChild(col);
        setTimeout(() => { col.querySelector('.bar-fill').style.height = `${hPct}%`; }, 100);
    });

    // 3. Donut Chart (Muscles)
    renderDonutChart(history, prefs.muscleRange || "3m");

    // 4. Consistency Line
    renderConsistencyLine(history, prefs.consistencyRange || 8);
}

function renderDonutChart(history, range) {
    const svg = document.getElementById('donut-svg-container');
    const leg = document.getElementById('donut-legend-container');
    svg.innerHTML = ""; leg.innerHTML = "";
    
    let daysToFilter = 9999;
    if(range === '1m') daysToFilter = 30;
    if(range === '3m') daysToFilter = 90;
    
    document.getElementById('muscle-chart-ttl').innerText = `חלוקת נפח שרירים (${range === 'all' ? 'הכל' : range === '1m' ? 'חודש אחרון' : '3 חודשים'})`;

    const now = Date.now();
    let muscleVols = {};
    let totalVol = 0;

    history.forEach(wo => {
        const diff = (now - wo.timestamp) / (1000 * 3600 * 24);
        if(diff <= daysToFilter && wo.details) {
            Object.entries(wo.details).forEach(([exName, data]) => {
                const exDb = state.exercises.find(e => e.name === exName);
                if(exDb && exDb.muscles && exDb.muscles.length > 0) {
                    const m = exDb.muscles[0];
                    if(!muscleVols[m]) muscleVols[m] = 0;
                    muscleVols[m] += (data.vol || 0);
                    totalVol += (data.vol || 0);
                }
            });
        }
    });

    if(totalVol === 0) {
        document.getElementById('donut-center-val').innerText = "0";
        return;
    }

    const sorted = Object.entries(muscleVols).sort((a,b) => b[1] - a[1]).slice(0, 4);
    const colors =['#0A84FF', '#32D74B', '#FF9F0A', '#BF5AF2', '#FF453A'];
    
    document.getElementById('donut-center-val').innerText = (totalVol/1000).toFixed(1) + "k";
    
    const cx = 60, cy = 60, r = 45;
    const circum = 2 * Math.PI * r;
    let offset = 0;

    sorted.forEach(([mName, val], i) => {
        const pct = val / totalVol;
        const dashVal = pct * circum;
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', r);
        circle.setAttribute('fill', 'none'); circle.setAttribute('stroke', colors[i]);
        circle.setAttribute('stroke-width', '16');
        circle.setAttribute('stroke-dasharray', `${dashVal} ${circum}`);
        circle.setAttribute('stroke-dashoffset', -offset);
        circle.style.transition = "stroke-dashoffset 1s ease";
        svg.appendChild(circle);
        
        offset += dashVal;

        const pStr = Math.round(pct * 100) + "%";
        leg.innerHTML += `
            <div class="leg-row">
                <div class="leg-dot" style="background:${colors[i]}"></div>
                <div class="leg-nm">${mName}</div>
                <div class="leg-pct">${pStr}</div>
            </div>`;
    });
}

function renderConsistencyLine(history, limit) {
    const row = document.getElementById('cons-row-container');
    row.innerHTML = "";
    document.getElementById('cons-chart-ttl').innerText = `עקביות אימונים (${limit} אחרונים)`;

    const sliced = history.slice(0, limit).reverse();
    if(sliced.length < 2) return;

    for(let i=0; i<sliced.length; i++) {
        const isToday = i === sliced.length - 1;
        const d1 = new Date(sliced[i].timestamp);
        let gapStr = "-"; let cls = "t"; 
        
        if(i > 0) {
            const d0 = new Date(sliced[i-1].timestamp);
            const diffDays = Math.floor((d1 - d0) / (1000 * 3600 * 24));
            gapStr = diffDays;
            if(diffDays <= 5) cls = "g";
            else if(diffDays <= 9) cls = "o";
            else cls = "r";
        } else { gapStr = "✓"; }

        const dateStr = d1.getDate() + '/' + (d1.getMonth()+1);
        
        row.innerHTML += `
            <div class="c-dot-wrap">
                <div class="c-dot ${cls}">${gapStr}</div>
                <div class="c-date">${dateStr}</div>
            </div>
        `;
        if(i < sliced.length - 1) {
            row.innerHTML += `<div class="c-line"></div>`;
        }
    }
}

// --- MICRO VIEW ---
function loadMicroData() {
    const sel = document.getElementById('micro-ex-select');
    if(!sel || sel.options.length === 0) return;
    
    const exName = sel.value;
    const history = StorageManager.getArchive();
    const prefs = StorageManager.getAnalyticsPrefs();
    
    // Extract points
    let dataPoints =[];
    history.slice().reverse().forEach(wo => {
        if(wo.details && wo.details[exName] && wo.details[exName].sets) {
            let maxW = 0, maxE1RM = 0, totalVol = wo.details[exName].vol || 0;
            
            wo.details[exName].sets.forEach(setStr => {
                let w = 0, r = 0;
                let coreStr = setStr.includes('| Note:') ? setStr.split('| Note:')[0].trim() : setStr;
                try {
                    const parts = coreStr.split('x');
                    w = parseFloat(parts[0].replace(/[^0-9.]/g, ''));
                    r = parseInt(parts[1].split('(')[0].trim());
                    if(!isNaN(w) && !isNaN(r)) {
                        if(w > maxW) maxW = w;
                        const e1rm = calcE1RM(w, r, prefs.formula);
                        if(e1rm > maxE1RM) maxE1RM = e1rm;
                    }
                } catch(e){}
            });
            
            dataPoints.push({ date: wo.date.substring(0,5), e1rm: Math.round(maxE1RM), maxW: w, vol: totalVol });
        }
    });

    if(dataPoints.length === 0) return;

    // Render Line Chart
    renderLineChart(dataPoints, prefs);

    // Calculate PR
    let bestPR = { w: 0, r: 0, rir: '-', e1rm: 0, date: '-', ctx: '' };
    history.forEach(wo => {
        if(wo.details && wo.details[exName] && wo.details[exName].sets) {
            wo.details[exName].sets.forEach(setStr => {
                let w = 0, r = 0, rir = '-';
                let coreStr = setStr;
                let noteCtx = wo.type;
                if(setStr.includes('| Note:')) {
                    const p = setStr.split('| Note:');
                    coreStr = p[0].trim();
                    noteCtx += " • " + p[1].trim();
                }
                try {
                    const parts = coreStr.split('x');
                    w = parseFloat(parts[0].replace(/[^0-9.]/g, ''));
                    const rest = parts[1];
                    r = parseInt(rest.split('(')[0].trim());
                    const rirMatch = rest.match(/\(RIR (.*?)\)/);
                    if(rirMatch) rir = rirMatch[1];
                    
                    const e1rm = calcE1RM(w, r, prefs.formula);
                    if(e1rm > bestPR.e1rm || (e1rm === bestPR.e1rm && w > bestPR.w)) {
                        bestPR = { w, r, rir, e1rm: Math.round(e1rm), date: wo.date, ctx: noteCtx };
                    }
                } catch(e){}
            });
        }
    });

    document.getElementById('pr-val-weight').innerText = bestPR.w + " " + prefs.units;
    document.getElementById('pr-val-date').innerText = bestPR.date;
    document.getElementById('pr-val-reps').innerText = bestPR.r;
    document.getElementById('pr-val-rir').innerText = bestPR.rir;
    document.getElementById('pr-val-e1rm').innerText = bestPR.e1rm;
    document.getElementById('pr-val-ctx').innerText = bestPR.ctx;
}

function calcE1RM(w, r, formula) {
    if(r === 1) return w;
    if(formula === 'brzycki') return w * (36 / (37 - r));
    if(formula === 'lombardi') return w * Math.pow(r, 0.10);
    return w * (1 + (r / 30)); // default epley
}

function renderLineChart(dataPoints, prefs) {
    const limit = prefs.microPoints || 6;
    const axis = prefs.microAxis || 'e1rm';
    const sliced = dataPoints.slice(-limit);
    
    let titleStr = "Estimated 1RM";
    if(axis === 'maxW') titleStr = "משקל עבודה מקסימלי";
    if(axis === 'vol') titleStr = "נפח מצטבר לתרגיל";
    document.getElementById('lc-ttl').innerText = titleStr;

    const svg = document.getElementById('lc-svg-container');
    const spark = document.getElementById('spark-svg-container');
    svg.innerHTML = ""; spark.innerHTML = "";
    
    const svgW = 320, svgH = 165, padY = 25, padX = 20;
    
    let vals = sliced.map(d => d[axis]);
    let minV = Math.min(...vals); let maxV = Math.max(...vals);
    if(minV === maxV) { minV -= 10; maxV += 10; }
    
    const getX = i => padX + (i * ((svgW - padX*2) / Math.max(1, sliced.length - 1)));
    const getY = v => svgH - padY - ((v - minV) / (maxV - minV)) * (svgH - padY * 2);

    let pathD = "";
    sliced.forEach((pt, i) => {
        const x = getX(i), y = getY(pt[axis]);
        pathD += (i === 0 ? `M ${x} ${y} ` : `L ${x} ${y} `);
        
        // Add Grid Lines & Date Labels
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x); line.setAttribute('y1', padY);
        line.setAttribute('x2', x); line.setAttribute('y2', svgH - padY);
        line.setAttribute('stroke', 'rgba(255,255,255,0.05)');
        svg.appendChild(line);

        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', x); txt.setAttribute('y', svgH - 5);
        txt.setAttribute('fill', 'rgba(255,255,255,0.4)');
        txt.setAttribute('font-size', '10'); txt.setAttribute('text-anchor', 'middle');
        txt.textContent = pt.date;
        svg.appendChild(txt);
        
        // Value Text
        const valTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        valTxt.setAttribute('x', x); valTxt.setAttribute('y', y - 10);
        valTxt.setAttribute('fill', 'var(--accent)'); valTxt.setAttribute('font-size', '11');
        valTxt.setAttribute('font-weight', 'bold'); valTxt.setAttribute('text-anchor', 'middle');
        valTxt.textContent = axis === 'vol' ? (pt[axis]/1000).toFixed(1)+'k' : pt[axis];
        svg.appendChild(valTxt);
    });

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD); path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--accent)'); path.setAttribute('stroke-width', '3');
    path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);

    sliced.forEach((pt, i) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', getX(i)); circle.setAttribute('cy', getY(pt[axis]));
        circle.setAttribute('r', '4'); circle.setAttribute('fill', '#1c1c1e');
        circle.setAttribute('stroke', 'var(--accent)'); circle.setAttribute('stroke-width', '2');
        svg.appendChild(circle);
    });

    // Intensity / Sparkline Logic
    if(sliced.length >= 2) {
        const first = sliced[0][axis];
        const last = sliced[sliced.length-1][axis];
        const delta = last - first;
        const pct = (delta / first) * 100;
        
        const isUp = delta >= 0;
        const col = isUp ? 'var(--success)' : 'var(--danger)';
        const sign = isUp ? '+' : '';
        
        document.getElementById('int-val-score').innerText = last;
        document.getElementById('int-val-delta').innerText = `${sign}${pct.toFixed(1)}% (${limit} אחרונים)`;
        document.getElementById('int-val-delta').style.color = col;

        const spW = 140, spH = 52, sPad = 5;
        const getSpX = i => sPad + (i * ((spW - sPad*2) / Math.max(1, sliced.length - 1)));
        const getSpY = v => spH - sPad - ((v - minV) / (maxV - minV)) * (spH - sPad * 2);
        
        let spPath = "";
        sliced.forEach((pt, i) => { spPath += (i === 0 ? `M ${getSpX(i)} ${getSpY(pt[axis])} ` : `L ${getSpX(i)} ${getSpY(pt[axis])} `); });
        
        const spP = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        spP.setAttribute('d', spPath); spP.setAttribute('fill', 'none');
        spP.setAttribute('stroke', col); spP.setAttribute('stroke-width', '2');
        spP.setAttribute('stroke-linecap', 'round');
        spark.appendChild(spP);
    }
}

function togglePRAccordion() {
    const body = document.getElementById('pr-body-container');
    const icon = document.getElementById('pr-arr-icon');
    body.classList.toggle('open');
    icon.classList.toggle('open');
    haptic('light');
}

// --- CHIP FILTERS ACTIONS ---
function setVolumeRange(val, btn) {
    const prefs = StorageManager.getAnalyticsPrefs(); prefs.volumeRange = val; StorageManager.saveAnalyticsPrefs(prefs);
    btn.parentElement.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); btn.classList.add('active');
    renderAnalyticsMacro(StorageManager.getArchive(), prefs); haptic('light');
}
function setMuscleRange(val, btn) {
    const prefs = StorageManager.getAnalyticsPrefs(); prefs.muscleRange = val; StorageManager.saveAnalyticsPrefs(prefs);
    btn.parentElement.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); btn.classList.add('active');
    renderAnalyticsMacro(StorageManager.getArchive(), prefs); haptic('light');
}
function setConsistencyRange(val, btn) {
    const prefs = StorageManager.getAnalyticsPrefs(); prefs.consistencyRange = val; StorageManager.saveAnalyticsPrefs(prefs);
    btn.parentElement.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); btn.classList.add('active');
    renderAnalyticsMacro(StorageManager.getArchive(), prefs); haptic('light');
}
function setMicroAxis(val, btn) {
    const prefs = StorageManager.getAnalyticsPrefs(); prefs.microAxis = val; StorageManager.saveAnalyticsPrefs(prefs);
    btn.parentElement.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); btn.classList.add('active');
    loadMicroData(); haptic('light');
}
function setMicroPoints(val, btn) {
    const prefs = StorageManager.getAnalyticsPrefs(); prefs.microPoints = val; StorageManager.saveAnalyticsPrefs(prefs);
    btn.parentElement.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); btn.classList.add('active');
    loadMicroData(); haptic('light');
}

// --- SETTINGS SHEETS ---
function openAnalyticsSettings() {
    const prefs = StorageManager.getAnalyticsPrefs();
    const drawer = document.getElementById('sheet-modal');
    const content = document.getElementById('sheet-content');
    const tpl = document.getElementById('tpl-analytics-settings').content.cloneNode(true);
    
    content.innerHTML = ""; content.appendChild(tpl);
    
    document.getElementById('pref-name').value = prefs.name || "";
    document.getElementById('pref-units').value = prefs.units || "kg";
    document.getElementById('pref-formula').value = prefs.formula || "epley";
    
    document.getElementById('sheet-overlay').style.display = 'block';
    drawer.classList.add('open');
}

function saveAnalyticsSettings() {
    const prefs = StorageManager.getAnalyticsPrefs();
    prefs.name = document.getElementById('pref-name').value.trim();
    prefs.units = document.getElementById('pref-units').value;
    prefs.formula = document.getElementById('pref-formula').value;
    
    StorageManager.saveAnalyticsPrefs(prefs);
    closeDayDrawer();
    initAnalytics(); // Re-render
    if(typeof renderDashboardStats === 'function') renderDashboardStats();
    haptic('success');
}

function openHeroSettings() {
    const prefs = StorageManager.getAnalyticsPrefs();
    const drawer = document.getElementById('sheet-modal');
    const content = document.getElementById('sheet-content');
    const tpl = document.getElementById('tpl-hero-settings').content.cloneNode(true);
    
    content.innerHTML = ""; content.appendChild(tpl);
    
    const cbs = content.querySelectorAll('.hero-metric-cb');
    cbs.forEach(cb => {
        if(prefs.heroMetrics && prefs.heroMetrics.includes(cb.value)) cb.checked = true;
        
        // Max 3 Limitation logic
        cb.addEventListener('change', () => {
            const checked = content.querySelectorAll('.hero-metric-cb:checked');
            if(checked.length > 3) {
                cb.checked = false;
                alert("ניתן לבחור עד 3 מדדים שיוצגו במסך הבית");
            }
        });
    });
    
    document.getElementById('sheet-overlay').style.display = 'block';
    drawer.classList.add('open');
}

function saveHeroSettings() {
    const checked = document.querySelectorAll('#sheet-content .hero-metric-cb:checked');
    if(checked.length !== 3) { alert("חובה לבחור בדיוק 3 מדדים"); return; }
    
    const prefs = StorageManager.getAnalyticsPrefs();
    prefs.heroMetrics = Array.from(checked).map(c => c.value);
    
    StorageManager.saveAnalyticsPrefs(prefs);
    closeDayDrawer();
    if(typeof renderDashboardStats === 'function') renderDashboardStats(); // Refresh Home screen
    haptic('success');
}
