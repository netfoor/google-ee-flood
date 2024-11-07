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

// Cargar datos de ERA5-Land de humedad del suelo
var era5 = ee.ImageCollection('ECMWF/ERA5_LAND/HOURLY')
    .filterBounds(mexico)
    .filterDate(startDate, endDate)
    .select(['skin_temperature', 'total_precipitation', 'volumetric_soil_water_layer_1'])  // Selecciona variables importantes
    .map(fillNoData);

// Verificar la disponibilidad de datos
print('Número de imágenes en la colección ERA5-Land:', era5.size());

// Calcular estadísticas
var era5Mean = era5.mean().clip(mexico);
var era5Max = era5.max().clip(mexico);
var era5Min = era5.min().clip(mexico);
var era5Std = era5.reduce(ee.Reducer.stdDev()).clip(mexico);

// Parámetros de visualización
var visParams = {
    temperatura: {
        min: 290,  // Kelvin
        max: 310,
        palette: ['blue', 'green', 'yellow', 'red']
    },
    precipitacion: {
        min: 0,
        max: 0.1,  // Ajusta según los datos
        palette: ['lightblue', 'blue', 'darkblue']
    },
    humedad: {
        min: 0,
        max: 0.5,
        palette: ['#ffffd9', '#41b6c4', '#081d58']
    }
};

// Agregar capas al mapa
Map.centerObject(mexico, 5);
Map.addLayer(era5Mean.select('skin_temperature'), visParams.temperatura, 'Temperatura Superficial Media');
Map.addLayer(era5Mean.select('total_precipitation'), visParams.precipitacion, 'Precipitación Total Media', false);
Map.addLayer(era5Mean.select('volumetric_soil_water_layer_1'), visParams.humedad, 'Humedad Volumétrica de la Capa 1 Media');

// Crear panel de control
var panel = ui.Panel({
    style: {
        position: 'top-right',
        padding: '8px'
    }
});

// Añadir título
panel.add(ui.Label({
    value: 'Variables ERA5-Land',
    style: {fontWeight: 'bold', fontSize: '16px', margin: '0 0 10px 0'}
}));

// Función para crear checkbox
function createLayerCheckbox(label, layer, visParams) {
    var checkbox = ui.Checkbox({
        label: label,
        value: label === 'Temperatura Superficial Media',
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
panel.add(createLayerCheckbox('Temperatura Superficial Media', era5Mean.select('skin_temperature'), visParams.temperatura));
panel.add(createLayerCheckbox('Precipitación Total Media', era5Mean.select('total_precipitation'), visParams.precipitacion));
panel.add(createLayerCheckbox('Humedad Volumétrica de la Capa 1 Media', era5Mean.select('volumetric_soil_water_layer_1'), visParams.humedad));

Map.add(panel);

// Crear imagen compuesta con todas las variables
var variables = ee.Image.cat([
    era5Mean.select('skin_temperature').rename('temperatura_media'),
    era5Mean.select('total_precipitation').rename('precipitacion_media'),
    era5Mean.select('volumetric_soil_water_layer_1').rename('humedad_volumetrica_media'),
    era5Max.select('volumetric_soil_water_layer_1').rename('humedad_volumetrica_max'),
    era5Min.select('volumetric_soil_water_layer_1').rename('humedad_volumetrica_min'),
    era5Std.select('volumetric_soil_water_layer_1_stdDev').rename('humedad_volumetrica_std')
]);

// Crear una cuadrícula de puntos
var grid = variables.sample({
    region: mexico,
    scale: 10000,  // Resolución de ERA5-Land
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
    description: 'era5_mexico_data',
    folder: 'Inundaciones_Mexico',
    fileFormat: 'CSV',
    selectors: [
        'id_punto',
        'longitud',
        'latitud',
        'fecha_inicio',
        'fecha_fin',
        'temperatura_media',
        'precipitacion_media',
        'humedad_volumetrica_media',
        'humedad_volumetrica_max',
        'humedad_volumetrica_min',
        'humedad_volumetrica_std'
    ]
});
