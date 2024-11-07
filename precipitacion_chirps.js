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
  
  // Cargar y procesar datos con mejor manejo de valores nulos
  var chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
    .filterBounds(mexico)
    .filterDate(startDate, endDate)
    .map(fillNoData);
  
  var precipitacion = chirps.mean().clip(mexico);
  var precipMaxima = chirps.max().clip(mexico);
  var precipAcumulada = chirps.sum().clip(mexico);
  
  var modisLST = ee.ImageCollection('MODIS/061/MOD11A1')
    .filterBounds(mexico)
    .filterDate(startDate, endDate)
    .select('LST_Day_1km')
    .map(fillNoData);
  
  var temperatura = modisLST.mean().clip(mexico);
  var tempMaxima = modisLST.max().clip(mexico);
  
  var smap = ee.ImageCollection('NASA_USDA/HSL/SMAP_soil_moisture')
    .filterBounds(mexico)
    .filterDate(startDate, endDate)
    .select('ssm')
    .map(fillNoData);
  
  var humedadSuelo = smap.mean().clip(mexico);
  
  var modisNDVI = ee.ImageCollection('MODIS/061/MOD13Q1')
    .filterBounds(mexico)
    .filterDate(startDate, endDate)
    .select('NDVI')
    .map(fillNoData);
  
  var ndvi = modisNDVI.mean().clip(mexico);
  
  var elevation = ee.Image('USGS/SRTMGL1_003').clip(mexico);
  var slope = ee.Terrain.slope(elevation);
  
  // Parámetros de visualización
  var visParams = {
    precipitacion: {
      min: 0, max: 50,
      palette: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6']
    },
    precipMaxima: {
      min: 0, max: 100,
      palette: ['#ffffcc', '#a1dab4', '#41b6c4', '#2c7fb8', '#253494']
    },
    temperatura: {
      min: 290, max: 310,
      palette: ['blue', 'yellow', 'red']
    },
    humedad: {
      min: 0, max: 1,
      palette: ['#ffffd9', '#41b6c4', '#081d58']
    },
    ndvi: {
      min: 0, max: 9000,
      palette: ['brown', 'yellow', 'green']
    },
    elevation: {
      min: 0, max: 4000,
      palette: ['#008435', '#1CAC78', '#EDE6D6', '#736F6E', '#FFFFFF']
    }
  };
  
  // Agregar capas al mapa
  Map.addLayer(precipitacion, visParams.precipitacion, 'Precipitación Media');
  Map.addLayer(precipMaxima, visParams.precipMaxima, 'Precipitación Máxima', false);
  Map.addLayer(precipAcumulada, {min: 0, max: 1000, palette: visParams.precipitacion.palette}, 'Precipitación Acumulada', false);
  Map.addLayer(temperatura, visParams.temperatura, 'Temperatura Media', false);
  Map.addLayer(tempMaxima, visParams.temperatura, 'Temperatura Máxima', false);
  Map.addLayer(humedadSuelo, visParams.humedad, 'Humedad del Suelo', false);
  Map.addLayer(ndvi, visParams.ndvi, 'NDVI', false);
  Map.addLayer(elevation, visParams.elevation, 'Elevación', false);
  Map.addLayer(slope, {min: 0, max: 60, palette: ['green', 'yellow', 'red']}, 'Pendiente', false);
  
  // Centrar mapa
  Map.centerObject(mexico, 5);
  
  // Crear panel de control
  var panel = ui.Panel({
    style: {
      position: 'top-right',
      padding: '8px'
    }
  });
  
  // Añadir título al panel
  panel.add(ui.Label({
    value: 'Variables de Análisis',
    style: {fontWeight: 'bold', fontSize: '16px', margin: '0 0 10px 0'}
  }));
  
  // Función para crear checkbox
  function createLayerCheckbox(label, layer, visParams) {
    var checkbox = ui.Checkbox({
      label: label,
      value: label === 'Precipitación Media',  // Solo la primera capa activa por defecto
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
  
// [Todo el código anterior se mantiene igual hasta la parte de "Añadir controles para cada capa"]

// Añadir controles para cada capa
panel.add(createLayerCheckbox('Precipitación Media', precipitacion, visParams.precipitacion));
panel.add(createLayerCheckbox('Precipitación Máxima', precipMaxima, visParams.precipMaxima));
panel.add(createLayerCheckbox('Precipitación Acumulada', precipAcumulada, {min: 0, max: 1000, palette: visParams.precipitacion.palette}));
panel.add(createLayerCheckbox('Temperatura Media', temperatura, visParams.temperatura));
panel.add(createLayerCheckbox('Temperatura Máxima', tempMaxima, visParams.temperatura));
panel.add(createLayerCheckbox('Humedad del Suelo', humedadSuelo, visParams.humedad));
panel.add(createLayerCheckbox('NDVI', ndvi, visParams.ndvi));
panel.add(createLayerCheckbox('Elevación', elevation, visParams.elevation));
panel.add(createLayerCheckbox('Pendiente', slope, {min: 0, max: 60, palette: ['green', 'yellow', 'red']}));

Map.add(panel);

// Crear imagen compuesta con todas las variables
var variables = ee.Image.cat([
  precipitacion.rename('chirps_precip_media'),
  precipMaxima.rename('chirps_precip_maxima'),
  precipAcumulada.rename('chirps_precip_acumulada'),
  temperatura.rename('modis_temp_media'),
  tempMaxima.rename('modis_temp_maxima'),
  humedadSuelo.rename('smap_humedad_suelo'),
  ndvi.rename('modis_ndvi'),
  elevation.rename('dem_elevacion'),
  slope.rename('dem_pendiente')
]);

// Crear una cuadrícula de puntos
var grid = variables.sample({
  region: mexico,
  scale: 1000, // Resolución en metros
  projection: 'EPSG:4326',
  numPixels: 5000,
  geometries: true
});

// Estandarizar formato para exportación
var gridWithCoords = grid.map(function(feature) {
  var coords = feature.geometry().coordinates();
  // Estandarizar formato de coordenadas a 6 decimales
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
  description: 'variables_mexico_completo',
  folder: 'Inundaciones_Mexico',
  fileFormat: 'CSV',
  selectors: [
    'id_punto',
    'longitud',
    'latitud',
    'fecha_inicio',
    'fecha_fin',
    'chirps_precip_media',
    'chirps_precip_maxima',
    'chirps_precip_acumulada',
    'modis_temp_media',
    'modis_temp_maxima',
    'smap_humedad_suelo',
    'modis_ndvi',
    'dem_elevacion',
    'dem_pendiente'
  ]
});