// ============================================
// CHARTS.JS - TIMELINE E GRAFICI INTERATTIVI
// ============================================

let timelineChart = null;
let allTimelineData = [];
let filteredTimelineData = [];

// ============================================
// CARICAMENTO DATI TIMELINE
// ============================================

async function loadTimelineData() {
  try {
    console.log('Caricamento dati per grafici timeline...');
    
    // Prova prima events_timeline.json
    let response = await fetch('assets/data/events_timeline.json');
    
    if (!response.ok) {
      // Fallback a events.geojson
      console.log('Fallback a events.geojson...');
      response = await fetch('assets/data/events.geojson');
      
      if (!response.ok) {
        throw new Error(`File non trovato! Status: ${response.status}`);
      }
      
      const geojsonData = await response.json();
      allTimelineData = convertGeoJSONToTimeline(geojsonData);
    } else {
      const timelineData = await response.json();
      allTimelineData = convertTimelineJSONToData(timelineData);
    }
    
    if (allTimelineData.length === 0) {
      console.warn('⚠️ Nessun dato valido trovato');
      return;
    }
    
    console.log('✅ Dati timeline caricati:', allTimelineData.length, 'eventi');
    
    // Inizializza filtri
    populateTypeFilter();
    populateDateFilters();
    
    // Mostra tutti i dati inizialmente
    filteredTimelineData = [...allTimelineData];
    
    // Crea grafico
    initializeChart();
    updateChart();
    
  } catch (error) {
    console.error('❌ Errore caricamento dati timeline:', error);
    
    const chartContainer = document.getElementById('timelineChart')?.parentElement;
    if (chartContainer) {
      chartContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #dc3545;">
          <h4>⚠️ Impossibile caricare i dati del grafico</h4>
          <p style="font-size: 0.9em; color: #666;">
            Errore: ${error.message}<br>
            Verifica che i file siano presenti in <strong>assets/data/</strong>
          </p>
        </div>
      `;
    }
  }
}

// ============================================
// CONVERSIONE DATI - VERSIONE CORRETTA PER IL TUO JSON
// ============================================

function convertTimelineJSONToData(timelineData) {
  if (!timelineData.events || !Array.isArray(timelineData.events)) {
    console.error('❌ Struttura JSON non valida: manca array events');
    return [];
  }
  
  const validEvents = [];
  
  timelineData.events.forEach((event, index) => {
    try {
      // Validazione campi essenziali
      if (!event.date) {
        console.warn(`⚠️ Evento ${index}: manca campo date, skip`);
        return;
      }
      
      // Converti data da formato DD/MM/YY a ISO YYYY-MM-DD
      let dateISO = event.date;
      if (dateISO.includes('/')) {
        const parts = dateISO.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          let year = parts[2];
          
          // Converti anno a 2 cifre in 4 cifre
          if (year.length === 2) {
            year = '20' + year;
          }
          // Se l'anno ha già 4 cifre ma è solo "2025" scritto male
          else if (year.length === 4) {
            year = year;
          }
          
          dateISO = `${year}-${month}-${day}`;
        }
      }
      
      const dateObj = new Date(dateISO);
      
      // Valida data
      if (isNaN(dateObj.getTime())) {
        console.warn(`⚠️ Evento ${index}: data non valida (${event.date} -> ${dateISO}), skip`);
        return;
      }
      
      // Crea oggetto evento
      validEvents.push({
        date: dateISO,
        dateObj: dateObj,
        title: event.title || 'Evento senza titolo',
        type: event.type || 'Drones',
        verification: event.verification || 'not verified'
      });
      
    } catch (err) {
      console.error(`❌ Errore processando evento ${index}:`, err);
    }
  });
  
  console.log(`✅ Convertiti ${validEvents.length}/${timelineData.events.length} eventi validi`);
  return validEvents;
}

function convertGeoJSONToTimeline(geojsonData) {
  if (!geojsonData.features) {
    console.error('❌ Nessun array features nel GeoJSON');
    return [];
  }
  
  const validEvents = [];
  
  geojsonData.features.forEach((feature, index) => {
    try {
      const props = feature.properties || {};
      
      if (!props.date) {
        console.warn(`⚠️ Feature ${index}: manca campo date, skip`);
        return;
      }
      
      // Converti data
      let dateISO = props.date;
      if (dateISO.includes('/')) {
        const parts = dateISO.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          let year = parts[2];
          if (year.length === 2) year = '20' + year;
          dateISO = `${year}-${month}-${day}`;
        }
      }
      
      const dateObj = new Date(dateISO);
      
      if (isNaN(dateObj.getTime())) {
        console.warn(`⚠️ Feature ${index}: data non valida (${dateISO}), skip`);
        return;
      }
      
      validEvents.push({
        date: dateISO,
        dateObj: dateObj,
        title: props.title || 'Evento senza titolo',
        type: props.type || 'Drones',
        verification: props.verification || 'not verified'
      });
      
    } catch (err) {
      console.error(`❌ Errore processando feature ${index}:`, err);
    }
  });
  
  console.log(`✅ Convertiti ${validEvents.length}/${geojsonData.features.length} eventi validi`);
  return validEvents;
}

// ============================================
// INIZIALIZZAZIONE GRAFICO
// ============================================

function initializeChart() {
  const ctx = document.getElementById('timelineChart');
  if (!ctx) {
    console.error('❌ Canvas timelineChart non trovato nel DOM');
    return;
  }
  
  // Distruggi grafico esistente se presente
  if (timelineChart) {
    timelineChart.destroy();
  }
  
  // Crea nuovo grafico
  timelineChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Eventi per data',
        data: [],
        backgroundColor: 'rgba(69, 162, 158, 0.6)',
        borderColor: 'rgba(69, 162, 158, 1)',
        borderWidth: 2,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: {
              size: 12,
              family: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif'
            }
          }
        },
        title: {
          display: true,
          text: 'Distribuzione Temporale degli Eventi',
          font: {
            size: 16,
            weight: 'bold',
            family: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif'
          },
          padding: 20
        },
        tooltip: {
          backgroundColor: 'rgba(11, 12, 16, 0.9)',
          titleFont: {
            size: 13,
            family: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif'
          },
          bodyFont: {
            size: 12,
            family: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif'
          },
          padding: 12,
          cornerRadius: 6
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 11,
              family: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif'
            }
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            font: {
              size: 11,
              family: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif'
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        }
      }
    }
  });
}

// ============================================
// AGGIORNAMENTO GRAFICO
// ============================================

function updateChart() {
  if (!timelineChart) {
    console.warn('⚠️ timelineChart non inizializzato');
    return;
  }
  
  // Aggrega eventi per data
  const eventsByDate = {};
  
  filteredTimelineData.forEach(event => {
    const dateKey = event.date;
    if (!eventsByDate[dateKey]) {
      eventsByDate[dateKey] = 0;
    }
    eventsByDate[dateKey]++;
  });
  
  // Ordina date
  const sortedDates = Object.keys(eventsByDate).sort();
  const counts = sortedDates.map(date => eventsByDate[date]);
  
  // Formatta date per visualizzazione
  const formattedDates = sortedDates.map(date => {
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  });
  
  // Aggiorna grafico
  timelineChart.data.labels = formattedDates;
  timelineChart.data.datasets[0].data = counts;
  timelineChart.data.datasets[0].label = `Eventi: ${filteredTimelineData.length} totali`;
  timelineChart.update();
}

// ============================================
// POPOLAMENTO FILTRI
// ============================================

function populateTypeFilter() {
  const typeFilter = document.getElementById('chartTypeFilter');
  if (!typeFilter) return;
  
  // Estrai tipi unici
  const types = [...new Set(allTimelineData.map(e => e.type))].sort();
  
  // Pulisci e ripopola
  typeFilter.innerHTML = '<option value="">Tutti i tipi</option>';
  types.forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    typeFilter.appendChild(option);
  });
}

function populateDateFilters() {
  const startDateInput = document.getElementById('chartStartDate');
  const endDateInput = document.getElementById('chartEndDate');
  
  if (!startDateInput || !endDateInput) return;
  
  // Trova min e max date
  const dates = allTimelineData.map(e => e.dateObj).filter(d => !isNaN(d));
  
  if (dates.length > 0) {
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    startDateInput.min = minDate.toISOString().split('T')[0];
    startDateInput.max = maxDate.toISOString().split('T')[0];
    endDateInput.min = minDate.toISOString().split('T')[0];
    endDateInput.max = maxDate.toISOString().split('T')[0];
  }
}

// ============================================
// FUNZIONI DI FILTRAGGIO
// ============================================

function filterByDateRange(startDate, endDate) {
  let filtered = [...allTimelineData];
  
  if (startDate) {
    filtered = filtered.filter(e => e.date >= startDate);
  }
  
  if (endDate) {
    filtered = filtered.filter(e => e.date <= endDate);
  }
  
  return filtered;
}

function filterByType(type) {
  if (!type) return allTimelineData;
  return allTimelineData.filter(e => e.type === type);
}

function applyFilters() {
  const startDate = document.getElementById('chartStartDate')?.value || '';
  const endDate = document.getElementById('chartEndDate')?.value || '';
  const type = document.getElementById('chartTypeFilter')?.value || '';
  
  // Applica filtri in sequenza
  filteredTimelineData = [...allTimelineData];
  
  if (startDate || endDate) {
    filteredTimelineData = filterByDateRange(startDate, endDate);
  }
  
  if (type) {
    filteredTimelineData = filteredTimelineData.filter(e => e.type === type);
  }
  
  updateChart();
}

// ============================================
// GESTORI EVENTI
// ============================================

function onDateChange() {
  applyFilters();
}

function onTypeChange() {
  applyFilters();
}

function resetFilters() {
  const startDateInput = document.getElementById('chartStartDate');
  const endDateInput = document.getElementById('chartEndDate');
  const typeFilter = document.getElementById('chartTypeFilter');
  
  if (startDateInput) startDateInput.value = '';
  if (endDateInput) endDateInput.value = '';
  if (typeFilter) typeFilter.value = '';
  
  filteredTimelineData = [...allTimelineData];
  updateChart();
}

// ============================================
// INIZIALIZZAZIONE
// ============================================

// Aggiungi event listeners quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
  const startDateInput = document.getElementById('chartStartDate');
  const endDateInput = document.getElementById('chartEndDate');
  const typeFilter = document.getElementById('chartTypeFilter');
  const resetBtn = document.getElementById('resetChartFilters');
  
  if (startDateInput) {
    startDateInput.addEventListener('change', onDateChange);
  }
  
  if (endDateInput) {
    endDateInput.addEventListener('change', onDateChange);
  }
  
  if (typeFilter) {
    typeFilter.addEventListener('change', onTypeChange);
  }
  
  if (resetBtn) {
    resetBtn.addEventListener('click', resetFilters);
  }
  
  // Carica dati
  loadTimelineData();
});

// Esponi funzioni globalmente per compatibilità
window.onDateChange = onDateChange;
window.onTypeChange = onTypeChange;
window.resetChartFilters = resetFilters;
