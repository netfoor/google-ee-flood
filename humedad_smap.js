// Definir geometría de México
var mexico = ee.Geometry.Rectangle({
    coords: [-117.12776, 14.5388286, -86.811982, 32.72083],
    geodesic: false
  });
  
  // Definir periodo de análisis
  var startDate = '2023-06-01';
  var endDate = '2023-10-31';
  
  // Función para manejar valores nulos
  var fillNoData = function(image) {
    var filled = image.focal_mean({
      radius: 2,
      kernelType: 'square'
    });
    return image.unmask(filled);
  };
  
  // Cargar datos SMAP
  var smap = ee.ImageCollection('NASA_USDA/HSL/SMAP_soil_moisture')
    .filterBounds(mexico)
    .filterDate(startDate, endDate)
    .map(fillNoData);
  
  // Seleccionar y procesar variables específicas de SMAP
  var smapVariables = smap
    .select([
      'ssm',           // Humedad superficial del suelo
      'susm',          // Humedad del suelo no saturada
      'smp',           // Probabilidad de humedad del suelo
      'ssma'           // Anomalía de humedad superficial del suelo
    ]);
  
  // Calcular estadísticas
  var smapMean = smapVariables.mean().clip(mexico);
  var smapMax = smapVariables.max().clip(mexico);
  var smapMin = smapVariables.min().clip(mexico);
  var smapStd = smapVariables.reduce(ee.Reducer.stdDev()).clip(mexico);
  
  // Parámetros de visualización
  var visParams = {
    humedad: {
      min: 0,
      max: 1,
      palette: ['#ffffd9', '#41b6c4', '#081d58']
    },
    anomalia: {
      min: -1,
      max: 1,
      palette: ['#d73027', '#fee090', '#4575b4']
    },
    probabilidad: {
      min: 0,
      max: 100,
      palette: ['red', 'yellow', 'green']
    }
  };
  
  // Agregar capas al mapa
  Map.addLayer(smapMean.select('ssm'), visParams.humedad, 'Humedad Superficial Media');
  Map.addLayer(smapMean.select('susm'), visParams.humedad, 'Humedad No Saturada Media', false);
  Map.addLayer(smapMean.select('smp'), visParams.probabilidad, 'Probabilidad de Humedad', false);
  Map.addLayer(smapMean.select('ssma'), visParams.anomalia, 'Anomalía de Humedad', false);
  
  // Centrar mapa
  Map.centerObject(mexico, 5);
  
  // Crear panel de control
  var panel = ui.Panel({
    style: {
      position: 'top-right',
      padding: '8px'
    }
  });
  
  // Añadir título
  panel.add(ui.Label({
    value: 'Variables SMAP',
    style: {fontWeight: 'bold', fontSize: '16px', margin: '0 0 10px 0'}
  }));
  
  // Función para crear checkbox
  function createLayerCheckbox(label, layer, visParams) {
    var checkbox = ui.Checkbox({
      label: label,
      value: label === 'Humedad Superficial Media',
      onChange: function(checked) {
        if (checked) {
          Map.addLayer(layer, visParams, label);
        } else {
          Map.layers().forEach(function(layer) {
            if (layer.getName() === label) {
              Map.remove(layer);
            }
          });
        }
      }
    });
    return checkbox;
  }
  
  // Añadir controles para cada capa
  panel.add(createLayerCheckbox('Humedad Superficial Media', smapMean.select('ssm'), visParams.humedad));
  panel.add(createLayerCheckbox('Humedad No Saturada Media', smapMean.select('susm'), visParams.humedad));
  panel.add(createLayerCheckbox('Probabilidad de Humedad', smapMean.select('smp'), visParams.probabilidad));
  panel.add(createLayerCheckbox('Anomalía de Humedad', smapMean.select('ssma'), visParams.anomalia));
  
  Map.add(panel);
  
  // Crear imagen compuesta con todas las variables
  var variables = ee.Image.cat([
    smapMean.select('ssm').rename('smap_humedad_superficial'),
    smapMean.select('susm').rename('smap_humedad_no_saturada'),
    smapMean.select('smp').rename('smap_probabilidad'),
    smapMean.select('ssma').rename('smap_anomalia'),
    smapMax.select('ssm').rename('smap_humedad_max'),
    smapMin.select('ssm').rename('smap_humedad_min'),
    smapStd.select('ssm_stdDev').rename('smap_humedad_std')
  ]);
  
  // Crear una cuadrícula de puntos
  var grid = variables.sample({
    region: mexico,
    scale: 1000,  // Resolución SMAP
    projection: 'EPSG:4326',
    numPixels: 5000,
    geometries: true
  });
  
  // Estandarizar formato para exportación
  var gridWithCoords = grid.map(function(feature) {
    var coords = feature.geometry().coordinates();
    var lon = ee.Number(coords.get(0)).format('%.6f');
    var lat = ee.Number(coords.get(1)).format('%.6f');
    
    return feature
      .set('id_punto', ee.String(lon).cat('_').cat(lat))
      .set('longitud', lon)
      .set('latitud', lat)
      .set('fecha_inicio', startDate)
      .set('fecha_fin', endDate);
  });
  
  // Exportar con formato estandarizado
  Export.table.toDrive({
    collection: gridWithCoords,
    description: 'smap_mexico_data',
    folder: 'Inundaciones_Mexico',
    fileFormat: 'CSV',
    selectors: [
      'id_punto',
      'longitud',
      'latitud',
      'fecha_inicio',
      'fecha_fin',
      'smap_humedad_superficial',
      'smap_humedad_no_saturada',
      'smap_probabilidad',
      'smap_anomalia',
      'smap_humedad_max',
      'smap_humedad_min',
      'smap_humedad_std'
    ]
  });