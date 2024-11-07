// Definir geometría de México
var mexico = ee.Geometry.Rectangle({
    coords: [-117.12776, 14.5388286, -86.811982, 32.72083],
    geodesic: false
  });
  
  // Definir periodo de análisis
  var startDate = '2023-06-01';
  var endDate = '2023-10-31';
  
  // Función para convertir temperatura de Kelvin a Celsius
  var convertirACelsius = function(image) {
    return image.multiply(0.02).subtract(273.15)
      .copyProperties(image, ['system:time_start']);
  };
  
  // Función para escalar NDVI
  var escalarNDVI = function(image) {
    return image.multiply(0.0001)
      .copyProperties(image, ['system:time_start']);
  };
  
  // Función para manejar valores nulos
  var fillNoData = function(image) {
    var filled = image.focal_mean({
      radius: 2,
      kernelType: 'square'
    });
    return image.unmask(filled);
  };
  
  // TEMPERATURA (MOD11A1)
  var modisLST = ee.ImageCollection('MODIS/061/MOD11A1')
    .filterBounds(mexico)
    .filterDate(startDate, endDate)
    .select(['LST_Day_1km', 'LST_Night_1km'])
    .map(fillNoData)
    .map(convertirACelsius);
  
  // Calcular estadísticas de temperatura
  var tempDiurna = modisLST.select('LST_Day_1km').mean().clip(mexico);
  var tempNocturna = modisLST.select('LST_Night_1km').mean().clip(mexico);
  var tempDiurnaMax = modisLST.select('LST_Day_1km').max().clip(mexico);
  var tempDiurnaMin = modisLST.select('LST_Day_1km').min().clip(mexico);
  
  // NDVI (MOD13Q1 - 250m resolución)
  var modisNDVI = ee.ImageCollection('MODIS/061/MOD13Q1')
    .filterBounds(mexico)
    .filterDate(startDate, endDate)
    .select(['NDVI', 'EVI'])
    .map(fillNoData)
    .map(escalarNDVI);
  
  // Calcular estadísticas de vegetación
  var ndviMedio = modisNDVI.select('NDVI').mean().clip(mexico);
  var eviMedio = modisNDVI.select('EVI').mean().clip(mexico);
  var ndviMax = modisNDVI.select('NDVI').max().clip(mexico);
  var ndviMin = modisNDVI.select('NDVI').min().clip(mexico);
  
  // Parámetros de visualización
  var visParams = {
    temperatura: {
      min: 0,
      max: 40,
      palette: ['blue', 'yellow', 'red']
    },
    ndvi: {
      min: 0,
      max: 1,
      palette: ['brown', 'yellow', 'green']
    }
  };
  
  // Agregar capas al mapa
  Map.addLayer(tempDiurna, visParams.temperatura, 'Temperatura Diurna Media');
  Map.addLayer(tempNocturna, visParams.temperatura, 'Temperatura Nocturna Media', false);
  Map.addLayer(ndviMedio, visParams.ndvi, 'NDVI Medio');
  Map.addLayer(eviMedio, visParams.ndvi, 'EVI Medio', false);
  
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
    value: 'Variables MODIS',
    style: {fontWeight: 'bold', fontSize: '16px', margin: '0 0 10px 0'}
  }));
  
  // Función para crear checkbox
  function createLayerCheckbox(label, layer, visParams) {
    var checkbox = ui.Checkbox({
      label: label,
      value: label === 'Temperatura Diurna Media' || label === 'NDVI Medio',
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
  panel.add(createLayerCheckbox('Temperatura Diurna Media', tempDiurna, visParams.temperatura));
  panel.add(createLayerCheckbox('Temperatura Nocturna Media', tempNocturna, visParams.temperatura));
  panel.add(createLayerCheckbox('NDVI Medio', ndviMedio, visParams.ndvi));
  panel.add(createLayerCheckbox('EVI Medio', eviMedio, visParams.ndvi));
  
  Map.add(panel);
  
  // Crear imagen compuesta con todas las variables
  var variables = ee.Image.cat([
    tempDiurna.rename('temp_diurna'),
    tempNocturna.rename('temp_nocturna'),
    tempDiurnaMax.rename('temp_diurna_max'),
    tempDiurnaMin.rename('temp_diurna_min'),
    ndviMedio.rename('ndvi_medio'),
    eviMedio.rename('evi_medio'),
    ndviMax.rename('ndvi_max'),
    ndviMin.rename('ndvi_min')
  ]);
  
  // Crear una cuadrícula de puntos
  var grid = variables.sample({
    region: mexico,
    scale: 250, // Resolución MODIS NDVI
    projection: 'EPSG:4326',
    numPixels: 5000,
    geometries: true
  });
  
  // Agregar coordenadas y fechas
  var gridWithCoords = grid.map(function(feature) {
    var coords = feature.geometry().coordinates();
    return feature.set('longitude', coords.get(0))
                  .set('latitude', coords.get(1))
                  .set('fecha_inicio', startDate)
                  .set('fecha_fin', endDate);
  });

  // [El código anterior se mantiene igual hasta la parte de exportación]

// Estandarizar nombres y formato para facilitar la integración
var gridWithCoords = grid.map(function(feature) {
    var coords = feature.geometry().coordinates();
    // Estandarizar formato de coordenadas a 6 decimales
    var lon = ee.Number(coords.get(0)).format('%.6f');
    var lat = ee.Number(coords.get(1)).format('%.6f');
    
    return feature
      .set('id_punto', ee.String(lon).cat('_').cat(lat))  // Identificador único
      .set('longitud', lon)
      .set('latitud', lat)
      .set('fecha_inicio', startDate)
      .set('fecha_fin', endDate)
      // Estandarizar nombres de variables
      .set('modis_temp_dia', feature.get('temp_diurna'))
      .set('modis_temp_noche', feature.get('temp_nocturna'))
      .set('modis_temp_max', feature.get('temp_diurna_max'))
      .set('modis_temp_min', feature.get('temp_diurna_min'))
      .set('modis_ndvi', feature.get('ndvi_medio'))
      .set('modis_evi', feature.get('evi_medio'))
      .set('modis_ndvi_max', feature.get('ndvi_max'))
      .set('modis_ndvi_min', feature.get('ndvi_min'));
  });
  
  // Exportar con formato estandarizado
  Export.table.toDrive({
    collection: gridWithCoords,
    description: 'modis_mexico_data',  // Nombre estandarizado
    folder: 'Inundaciones_Mexico',
    fileFormat: 'CSV',
    selectors: [
      'id_punto',          // Identificador único para unir datos
      'longitud',          // Nombres estandarizados
      'latitud',
      'fecha_inicio',
      'fecha_fin',
      'modis_temp_dia',    // Prefijo 'modis_' para identificar fuente
      'modis_temp_noche',
      'modis_temp_max',
      'modis_temp_min',
      'modis_ndvi',
      'modis_evi',
      'modis_ndvi_max',
      'modis_ndvi_min'
    ]
  });
  