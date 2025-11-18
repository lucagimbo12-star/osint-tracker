// ============================================
// CHARTS.JS - TIMELINE E GRAFICI INTERATTIVI
// ============================================

let timelineChart = NaN;
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const geojsonData = await response.json();
      allTimelineData = convertGeoJSONToTimeline(geojsonData);
    } else {
      const timelineData = await response.json();
      allTimelineData = convertTimelineJSONToData(timelineData);
    }
    
    console.log('Dati timeline caricati:', allTimelineData.length, 'eventi');
    
    // Inizializza filtri
    populateTypeFilter();
    populateDateFilters();
    
    // Mostra tutti i dati inizialmente
    filteredTimelineData = [...allTimelineData];
    
    // Crea grafico
    initializeChart();
    updateChart();
    
  } catch (error) {
    console.error('Errore caricamento dati timeline:', error);
    alert('Errore nel caricamento dei dati per i grafici. Verifica che i file siano disponibili.');
  }
}

// ============================================
// CONVERSIONE DATI
// ============================================

function convertTimelineJSONToData(timelineData) {
  if (!timelineData.events) return [];
  
  return timelineData.events.map(event => {
    const text = event.text.text || '';
    const headline = event.text.headline || 'Evento';
    
    // Estrai tipo
    const tipoMatch = text.match(/Tipo:\s*(.+?)(?:<br>|$)/i);
    const tipo = tipoMatch ? tipoMatch[1].trim() : 'Drones';
    
    // Estrai verifica
    const verificaMatch = text.match(/Verifica:\s*(.+?)$/i);
    const verifica = verificaMatch ? verificaMatch[1].trim() : 'not verified';
    
    // Costruisci data ISO
    const year = event.start_date.year;
    const month = String(event.start_date.month).padStart(2, '0');
    const day = String(event.start_date.day).padStart(2, '0');
    const dateISO = `${year}-${month}-${day}`;
    
    return {
      date: dateISO,
      dateObj: new Date(dateISO),
      title: headline,
      type: tipo,
      verification: verifica
    };
  }).filter(e => !isNaN(e.dateObj.getTime())); // Filtra date invalide
}

function convertGeoJSONToTimeline(geojsonData) {
  if (!geojsonData.features) return [];
  
  return geojsonData.features.map(feature => {
    const props = feature.properties;
    
    // Converti data
    let dateISO = props.date || '';
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
    
    return {
      date: dateISO,
      dateObj: new Date(dateISO),
      title: props.title || 'Evento',
      type: props.type || 'Drones',
      verification: props.verification || 'not verified'
    };
  }).filter(e => !isNaN(e.dateObj.getTime())); // Filtra date invalide
}

// ============================================
// INIZIALIZZAZIONE GRAFICO
// ============================================

function initializeChart() {
  const ctx = document.getElementById('timelineChart');
  if (!ctx) {
    console.error('Canvas timelineChart non trovato');
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
  if (!timelineChart) return;
  
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
