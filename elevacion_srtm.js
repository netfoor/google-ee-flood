// Definir geometría de México
var mexico = ee.Geometry.Rectangle({
    coords: [-117.12776, 14.5388286, -86.811982, 32.72083],
    geodesic: false
  });
  
  // Cargar datos SRTM
  var srtm = ee.Image('USGS/SRTMGL1_003').clip(mexico);
  
  // Calcular variables derivadas de la elevación
  var slope = ee.Terrain.slope(srtm);  // Pendiente en grados
  var aspect = ee.Terrain.aspect(srtm);  // Orientación
  var hillshade = ee.Terrain.hillshade(srtm);  // Sombreado del relieve
  var roughness = ee.Terrain.roughness(srtm);  // Rugosidad del terreno
  
  // Calcular estadísticas de cuenca
  var flowAccumulation = ee.Terrain.flowAccumulation(srtm);  // Acumulación de flujo
  var flowDirection = ee.Terrain.flowDirection(srtm);  // Dirección de flujo
  
  // Parámetros de visualización
  var visParams = {
    elevacion: {
      min: 0,
      max: 4000,
      palette: ['#008435', '#1CAC78', '#EDE6D6', '#736F6E', '#FFFFFF']
    },
    pendiente: {
      min: 0,
      max: 60,
      palette: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#2171b5']
    },
    orientacion: {
      min: 0,
      max: 360,
      palette: ['#fc8d59', '#ffffbf', '#91cf60', '#ffffbf', '#fc8d59']
    },
    roughness: {
      min: 0,
      max: 100,
      palette: ['#ffffd4', '#fed98e', '#fe9929', '#d95f0e', '#993404']
    },
    flowAcc: {
      min: 0,
      max: 500,
      palette: ['#f7fbff', '#6baed6', '#2171b5']
    }
  };
  
  // Agregar capas al mapa
  Map.addLayer(srtm, visParams.elevacion, 'Elevación');
  Map.addLayer(slope, visParams.pendiente, 'Pendiente', false);
  Map.addLayer(aspect, visParams.orientacion, 'Orientación', false);
  Map.addLayer(hillshade, {min: 0, max: 255}, 'Sombreado', false);
  Map.addLayer(roughness, visParams.roughness, 'Rugosidad', false);
  Map.addLayer(flowAccumulation, visParams.flowAcc, 'Acumulación de Flujo', false);
  
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
    value: 'Variables Topográficas (SRTM)',
    style: {fontWeight: 'bold', fontSize: '16px', margin: '0 0 10px 0'}
  }));
  
  // Función para crear checkbox
  function createLayerCheckbox(label, layer, visParams) {
    var checkbox = ui.Checkbox({
      label: label,
      value: label === 'Elevación',
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
  panel.add(createLayerCheckbox('Elevación', srtm, visParams.elevacion));
  panel.add(createLayerCheckbox('Pendiente', slope, visParams.pendiente));
  panel.add(createLayerCheckbox('Orientación', aspect, visParams.orientacion));
  panel.add(createLayerCheckbox('Sombreado', hillshade, {min: 0, max: 255}));
  panel.add(createLayerCheckbox('Rugosidad', roughness, visParams.roughness));
  panel.add(createLayerCheckbox('Acumulación de Flujo', flowAccumulation, visParams.flowAcc));
  
  Map.add(panel);
  
  // Crear imagen compuesta con todas las variables
  var variables = ee.Image.cat([
    srtm.rename('srtm_elevacion'),
    slope.rename('srtm_pendiente'),
    aspect.rename('srtm_orientacion'),
    hillshade.rename('srtm_sombreado'),
    roughness.rename('srtm_rugosidad'),
    flowAccumulation.rename('srtm_flujo_acumulacion'),
    flowDirection.rename('srtm_direccion_flujo')
  ]);
  
  // Crear una cuadrícula de puntos
  var grid = variables.sample({
    region: mexico,
    scale: 30,  // Resolución nativa de SRTM
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
      // Para SRTM no necesitamos fechas ya que es estático, pero las mantenemos por consistencia
      .set('fecha_inicio', 'NA')
      .set('fecha_fin', 'NA');
  });
  
  // Exportar con formato estandarizado
  Export.table.toDrive({
    collection: gridWithCoords,
    description: 'srtm_mexico_data',
    folder: 'Inundaciones_Mexico',
    fileFormat: 'CSV',
    selectors: [
      'id_punto',
      'longitud',
      'latitud',
      'fecha_inicio',
      'fecha_fin',
      'srtm_elevacion',
      'srtm_pendiente',
      'srtm_orientacion',
      'srtm_sombreado',
      'srtm_rugosidad',
      'srtm_flujo_acumulacion',
      'srtm_direccion_flujo'
    ]
  });