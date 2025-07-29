import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import { zipData } from './data/zipData';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_ZIP_CODE_KEY = 'lastZipCode';

function toTitleCase(str) {
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function App() {
  const [query, setQuery] = useState('');
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [expandedDate, setExpandedDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState('');
  const [currentWeather, setCurrentWeather] = useState({
    temperature: null,
    textDescription: 'No data available',
    windSpeed: null,
    windDirection: '',
    humidity: null,
    heatIndex: null,
    dewPoint: null,
                barometricPressure: null,
    barometricPressure: null,
    observationTime: ''
  });

  // Load the last used zip code when the app starts
  useEffect(() => {
    async function loadLastZipCode() {
      try {
        const lastZipCode = await AsyncStorage.getItem(LAST_ZIP_CODE_KEY);
        if (lastZipCode !== null) {
          setQuery(lastZipCode);
        }
      } catch (e) {
        console.error("Failed to load last zip code", e);
      }
    }

    loadLastZipCode();
  }, []);

  // Save the current zip code when it changes
  useEffect(() => {
    async function saveZipCode() {
      try {
        await AsyncStorage.setItem(LAST_ZIP_CODE_KEY, query);
      } catch (e) {
        console.error("Failed to save zip code", e);
      }
    }

    if (query.length > 0) {
      saveZipCode();
    }
  }, [query]);

  const handleTextChange = (text) => {
    setQuery(text);
    if (text.length >= 4 && isNaN(text)) {
      const filtered = zipData.filter(item =>
        item['PHYSICAL CITY'].toLowerCase().startsWith(text.toLowerCase())
      );

      const uniqueMatches = [];
      const seen = new Set();

      for (const item of filtered) {
        const key = `${item['PHYSICAL CITY']},${item['PHYSICAL STATE']}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueMatches.push(item);
        }
      }

      uniqueMatches.sort((a, b) => {
        const cityA = a['PHYSICAL CITY'].toLowerCase();
        const cityB = b['PHYSICAL CITY'].toLowerCase();
        const stateA = a['PHYSICAL STATE'].toLowerCase();
        const stateB = b['PHYSICAL STATE'].toLowerCase();

        if (cityA < cityB) return -1;
        if (cityA > cityB) return 1;
        if (stateA < stateB) return -1;
        if (stateA > stateB) return 1;
        return 0;
      });

      setCitySuggestions(uniqueMatches.slice(0, 15));
    } else {
      setCitySuggestions([]);
    }
  };

  const onCitySelect = (city) => {
    Keyboard.dismiss();
    setQuery(city['PHYSICAL ZIP']);
    setCitySuggestions([]);
    handleSubmit(city['PHYSICAL ZIP']);
  };

  const handleSubmit = async (zip) => {
    Keyboard.dismiss(); // This line already hides the keyboard
    console.log("handleSubmit triggered");
    setError('');
    setLocation('');
    setDailyData([]);
    setHourlyData([]);
    setExpandedDate(null);
    setLoading(true);
    try {
      console.log(`Looking up zip data for ${zip}`);
      const zipInfo = zipData.find(row => row['PHYSICAL ZIP'] === zip);

      if (!zipInfo) {
        throw new Error('Invalid ZIP code');
      }

      console.log("Zip data found:", zipInfo);
      const place = {
        'place name': toTitleCase(zipInfo['PHYSICAL CITY']),
        'state abbreviation': zipInfo['PHYSICAL STATE'],
        latitude: zipInfo.latitude,
        longitude: zipInfo.longitude,
      };
      setLocation(`${place["place name"]}, ${place["state abbreviation"]}`);
      const lat = place.latitude;
      const lon = place.longitude;
      console.log(`Lat: ${lat}, Lon: ${lon}`);

      const pointsResp = await fetch(`https://api.weather.gov/points/${lat},${lon}`);
      if (!pointsResp.ok) throw new Error('Error fetching weather data');
      const pointsData = await pointsResp.json();
      console.log("Points data received:", pointsData);
      const { gridId, gridX, gridY } = pointsData.properties;
      console.log(`Grid ID: ${gridId}, GridX: ${gridX}, GridY: ${gridY}`);

      const forecastResp = await fetch(`https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast`);
      if (!forecastResp.ok) throw new Error('Error fetching daily forecast');
      const forecastData = await forecastResp.json();
      console.log("Daily forecast data received:", forecastData);
      setDailyData(processDailyForecast(forecastData.properties.periods));

      // Fetch observation stations
      const stationsResp = await fetch(pointsData.properties.observationStations);
      if (!stationsResp.ok) throw new Error('Error fetching observation stations');
      const stationsData = await stationsResp.json();
      console.log("Observation stations data received:", stationsData);

      // Get the first station's current observations
      if (stationsData.features && stationsData.features.length > 0) {
        // Check if the ID is a full URL and extract just the station ID
        const station = stationsData.features[0];
        let firstStationId = station.id;

        // If the ID contains "https://api.weather.gov/stations/", extract just the station code
        console.log("Raw station data:", station);
        if (typeof firstStationId === 'string' && firstStationId.includes('https://api.weather.gov/stations/')) {
          const match = firstStationId.match(/https:\/\/api\.weather\.gov\/stations\/([^\/]+)(?:\/|$)/);
          console.log("Regex match result:", match);
          if (match && match[1]) {
            firstStationId = match[1];
            console.log("Extracted station ID:", firstStationId);
          } else {
            console.warn("Failed to extract station ID from URL");

            // Try to find the station ID in other properties
            if (station.properties && station.properties.stationIdentifier) {
              firstStationId = station.properties.stationIdentifier;
              console.log("Found station ID in properties:", firstStationId);
            } else if (station.id.replace('https://api.weather.gov/stations/', '').replace('/', '')) {
              // Fallback: try to extract manually
              const manualExtract = firstStationId.replace('https://api.weather.gov/stations/', '').split('/')[0];
              if (manualExtract) {
                firstStationId = manualExtract;
                console.log("Extracted station ID manually:", firstStationId);
              } else {
                // Last resort: use the ID as-is, but this might cause issues
                console.warn("Using station ID as-is (might be a full URL):", firstStationId);
              }
            }
          }
        }

        console.log(`Fetching observations from station: ${firstStationId}`);
        let currentObsData = null;
        try {
          const currentObsResp = await fetch(`https://api.weather.gov/stations/${firstStationId}/observations`);
          if (!currentObsResp.ok) {
            const errorText = await currentObsResp.text();
            throw new Error(`Error fetching current observations: ${currentObsResp.status} - ${errorText}`);
          }
          currentObsData = await currentObsResp.json();
          console.log("Current observations data received:", currentObsData);

          // Find the most recent observation
          if (currentObsData && currentObsData.features && currentObsData.features.length > 0) {
            // Sort features by timestamp to get the most recent one
            const sortedFeatures = currentObsData.features.sort((a, b) => {
              return new Date(b.properties.timestamp).getTime() - new Date(a.properties.timestamp).getTime();
            });
            const latestObservation = sortedFeatures[0].properties;

            try {
              // Convert wind direction from degrees to cardinal direction
              let windDir = '';
              let windSpeed = null;
              let temperature = null;

              if (latestObservation.windDirection && latestObservation.windDirection.value !== undefined) {
                const dir = latestObservation.windDirection.value;
                if (dir >= 337.5 || dir < 22.5) {
                  windDir = 'N';
                } else if (dir >= 22.5 && dir < 67.5) {
                  windDir = 'NE';
                } else if (dir >= 67.5 && dir < 112.5) {
                  windDir = 'E';
                } else if (dir >= 112.5 && dir < 157.5) {
                  windDir = 'SE';
                } else if (dir >= 157.5 && dir < 202.5) {
                  windDir = 'S';
                } else if (dir >= 202.5 && dir < 247.5) {
                  windDir = 'SW';
                } else if (dir >= 247.5 && dir < 292.5) {
                  windDir = 'W';
                } else if (dir >= 292.5 && dir < 337.5) {
                  windDir = 'NW';
                }
              }

              if (latestObservation.windSpeed && latestObservation.windSpeed.value !== undefined) {
                windSpeed = (latestObservation.windSpeed.value * 0.621371).toFixed(1); // Convert km/h to mph
              }

              if (latestObservation.temperature && latestObservation.temperature.value !== undefined) {
                temperature = (latestObservation.temperature.value * 9/5) + 32; // Convert C to F
              }

              let humidity = null;
              if (latestObservation.relativeHumidity && latestObservation.relativeHumidity.value !== undefined) {
                humidity = latestObservation.relativeHumidity.value.toFixed(0); // Percentage
              }

              let heatIndexTemp = null;
              if (latestObservation.heatIndex && latestObservation.heatIndex.value !== undefined) {
                heatIndexTemp = (latestObservation.heatIndex.value * 9/5) + 32; // Convert C to F
              }

              let dewPointTemp = null;
              if (latestObservation.dewpoint && latestObservation.dewpoint.value !== undefined) {
                dewPointTemp = (latestObservation.dewpoint.value * 9/5) + 32; // Convert C to F
              }

              let barometricPressure = null;
              if (latestObservation.barometricPressure && latestObservation.barometricPressure.value !== undefined) {
                // Convert from Pascals to inches of mercury (inHg)
                barometricPressure = (latestObservation.barometricPressure.value / 3386.39).toFixed(2);
              }

              const observationTime = latestObservation.timestamp ? new Date(latestObservation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown';

              setCurrentWeather({
                temperature: temperature,
                textDescription: latestObservation.textDescription || 'No description available',
                windSpeed: windSpeed,
                windDirection: windDir,
                humidity: humidity,
                heatIndex: heatIndexTemp,
                dewPoint: dewPointTemp,
                barometricPressure: barometricPressure,
                observationTime: observationTime
              });
            } catch (error) {
              console.error("Error processing current weather data:", error);
              // Set a fallback state if there's an error processing the data
              setCurrentWeather({
                temperature: null,
                textDescription: 'Unable to retrieve current conditions',
                windSpeed: null,
                windDirection: '',
                humidity: null,
                heatIndex: null,
                dewPoint: null,
                barometricPressure: null,
                observationTime: ''
              });
            }
          } else {
            // No observations found
            setCurrentWeather({
              temperature: null,
              textDescription: 'No current observations available',
              windSpeed: null,
              windDirection: '',
              humidity: null,
              heatIndex: null,
              dewPoint: null,
                barometricPressure: null,
              observationTime: null
            });
          }
        } catch (error) {
          console.error("Error fetching current observations:", error);
          setCurrentWeather({
              humidity: null,
              heatIndex: null,
              dewPoint: null,
                barometricPressure: null,
              observationTime: null
            });
          setCurrentWeather({
            temperature: null,
            textDescription: "Unable to retrieve current conditions",
            windSpeed: null,
            windDirection: "",
            humidity: null,
            heatIndex: null,
            dewPoint: null,
                barometricPressure: null,
            observationTime: null
          });
        }
      }

      const hourlyResp = await fetch(`https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly`);
      if (!hourlyResp.ok) throw new Error('Error fetching hourly forecast');
      const hourlyDataJson = await hourlyResp.json();
      console.log("Hourly forecast data received:", hourlyDataJson);
      setHourlyData(hourlyDataJson.properties.periods);
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      setError(err.message);
    } finally {
      console.log("handleSubmit finished");
      setLoading(false);
    }
  };

  const processDailyForecast = (periods) => {
    const groups = {};
    periods.forEach((period) => {
      const dateStr = period.startTime.split('T')[0];
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(period);
    });
    const dates = Object.keys(groups).sort().slice(0, 7);
    return dates.map((date) => {
      const dayPeriods = groups[date];
      const dayPeriod = dayPeriods.find((p) => p.isDaytime);
      const nightPeriod = dayPeriods.find((p) => !p.isDaytime);
      const high = dayPeriod ? dayPeriod.temperature : Math.max(...dayPeriods.map((p) => p.temperature));
      const low = nightPeriod ? nightPeriod.temperature : Math.min(...dayPeriods.map((p) => p.temperature));
      const description = dayPeriod ? dayPeriod.shortForecast : dayPeriods[0].shortForecast;
      return { date, high, low, description, icon: dayPeriod ? dayPeriod.icon : dayPeriods[0].icon };
    });
  };

  const toggleExpand = (date) => {
    setExpandedDate(expandedDate === date ? null : date);
  };

  const hoursForDate = (date) => hourlyData.filter((hour) =>
    hour.startTime.startsWith(date)
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollViewContent}>
          <View style={styles.appContainer}>
            <Text style={styles.title}>7-Day Weather Forecast</Text>
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={handleTextChange}
                placeholder="Enter ZIP code or city name"
              />
              <TouchableOpacity style={styles.button} onPress={() => {
                Keyboard.dismiss();
                handleSubmit(query);
              }}>
                <Text style={styles.buttonText}>Submit</Text>
              </TouchableOpacity>
            </View>
            {citySuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {citySuggestions.map((item, index) => (
                  <TouchableOpacity key={index} style={styles.suggestionItem} onPress={() => onCitySelect(item)}>
                    <Text>{item['PHYSICAL CITY']}, {item['PHYSICAL STATE']}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {location ? <Text style={styles.locationText}>Weather forecast for {location}</Text> : null}

            {/* Only show Current Conditions section when data has been successfully loaded */}
            {!loading && !error && currentWeather.temperature !== null && (
              <View style={styles.currentWeatherContainer}>

                <Text style={styles.currentWeatherTitle}>
                  Current Conditions - {new Date().toLocaleString('default', {
                    weekday: 'short',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </Text>

                <View style={[styles.hourlyDetails, styles.currentWeatherDetails]}>
                  <View style={styles.hour}>
                    <View style={styles.hourPrimary}>
                      <Text style={styles.currentConditionsTemp}>{currentWeather.temperature}°F</Text>
                      <Text style={styles.hourDescription}>{currentWeather.textDescription}</Text>
                    </View>
                    <View style={styles.hourSecondary}>
                      {currentWeather.windSpeed && currentWeather.windDirection ? (
                        <View style={styles.hourlyDetailItem}>
                          <Text style={styles.hourlyDetailTitle}>Wind:</Text>
                          <Text style={styles.hourlyDetailValue}>{currentWeather.windSpeed} {currentWeather.windDirection}</Text>
                        </View>
                      ) : null}
                      {currentWeather.humidity !== null ? (
                        <View style={styles.hourlyDetailItem}>
                          <Text style={styles.hourlyDetailTitle}>Humidity:</Text>
                          <Text style={styles.hourlyDetailValue}>{currentWeather.humidity}%</Text>
                        </View>
                      ) : null}
                      {currentWeather.dewPoint !== null ? (
                        <View style={styles.hourlyDetailItem}>
                          <Text style={styles.hourlyDetailTitle}>Dew Point:</Text>
                          <Text style={styles.hourlyDetailValue}>{currentWeather.dewPoint}°F</Text>
                        </View>
                      ) : null}


                      {currentWeather.barometricPressure !== null ? (
                        <View style={styles.hourlyDetailItem}>
                          <Text style={styles.hourlyDetailTitle}>Pressure:</Text>
                          <Text style={styles.hourlyDetailValue}>{currentWeather.barometricPressure} inHg</Text>
                        </View>
                      ) : null}

                    </View>
                  </View>
                </View>
              </View>
            )}

            {loading ? <ActivityIndicator size="large" color="#007bff" /> : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.dailyForecast}>
              {dailyData.map((day) => (
                <View key={day.date} style={[styles.dayForecast, expandedDate === day.date && styles.dayForecastExpanded]}>
                  <TouchableOpacity style={styles.summary} onPress={() => toggleExpand(day.date)}>
                    <View style={styles.summaryDate}>
                      <Text style={styles.dateText}>
                        {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
                      </Text>
                      <Text style={styles.dateDayText}>
                        {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                    <View style={styles.summaryWeather}>

                      <Text style={styles.descriptionText}>{day.description}</Text>
                    </View>
                    <View style={styles.summaryTemp}>
                      <Text style={styles.tempText}>High: {day.high}°F</Text>
                      <Text style={styles.tempText}>Low: {day.low}°F</Text>
                    </View>
                  </TouchableOpacity>
                  {expandedDate === day.date && (
                    <View style={styles.hourlyDetails}>
                      {hoursForDate(day.date).map((hour) => (
                        <View key={hour.startTime} style={styles.hour}>
                          <View style={styles.hourPrimary}>
                            <Text style={styles.hourTime}>
                              {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })} {new Date(hour.startTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                            </Text>
                            <Text style={styles.hourTemp}>{hour.temperature}°F</Text>
                            <Text style={styles.hourDescription}>{hour.shortForecast}</Text>
                          </View>
                          <View style={styles.hourSecondary}>
                            {hour.probabilityOfPrecipitation && hour.probabilityOfPrecipitation.value !== null && (
                              <View style={styles.hourlyDetailItem}>
                                <Text style={styles.hourlyDetailTitle}>Precip:</Text>
                                <Text style={styles.hourlyDetailValue}>{hour.probabilityOfPrecipitation.value}%</Text>
                              </View>
                            )}
                            <View style={styles.hourlyDetailItem}>
                              <Text style={styles.hourlyDetailTitle}>Wind:</Text>
                              <Text style={styles.hourlyDetailValue}>{hour.windSpeed} {hour.windDirection}</Text>
                            </View>
                            <View style={styles.hourlyDetailItem}>
                              <Text style={styles.hourlyDetailTitle}>Humidity:</Text>
                              <Text style={styles.hourlyDetailValue}>{hour.relativeHumidity.value}%</Text>
                            </View>
                            <View style={styles.hourlyDetailItem}>
                              <Text style={styles.hourlyDetailTitle}>Dew Point:</Text>
                              <Text style={styles.hourlyDetailValue}>{((hour.dewpoint.value * 9/5) + 32).toFixed(1)}°F</Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  currentWeatherContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 15,
    marginVertical: 10,
    width: '100%',
    maxWidth: 580,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  currentWeatherTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 5,
  },
  currentWeatherDetails: {
    paddingTop: 5,
    width: '100%',
  },

  currentConditionsTemp: {
    fontWeight: 'bold',
    fontSize: 26, // 75% larger than the original 18px (18 * 1.75 = 31.5 ≈ 26)
    color: '#37474f',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#e0f2f7',
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: 5,
  },
  appContainer: {
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    width: '95%',
    maxWidth: 700,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 10,
  },
  locationText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#455a64',
    marginTop: 5,
    marginBottom: 5,
  },
  form: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
    width: '100%',
  },
  input: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#b0bec5',
    borderRadius: 8,
    marginRight: 10,
    fontSize: 16,
    maxWidth: 300,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    backgroundColor: '#007bff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#d32f2f',
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#ef9a9a',
    padding: 10,
    borderRadius: 8,
    marginTop: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
  },
  dailyForecast: {
    width: '100%',
    marginTop: 5,
    alignItems: 'center',
  },
  dayForecast: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    marginVertical: 5,
    paddingHorizontal: 20,
    paddingVertical: 15,
    width: '100%',
    maxWidth: 580,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  dayForecastExpanded: {
    backgroundColor: '#e3f2fd',
    borderColor: '#90caf9',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 6,
    paddingBottom: 25,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryDate: {
    alignItems: 'flex-start',
    paddingRight: 20
  },
  summaryWeather: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTemp: {
    flex: 1,
    alignItems: 'flex-end',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#37474f',
  },
  dateDayText: {
    fontSize: 14,
    color: '#546e7a',
  },
  icon: {
    width: 50,
    height: 50,
    marginRight: 10,
  },
  descriptionText: {
    flex: 1,
    fontSize: 16,
    color: '#37474f',
    textAlign: 'left',
  },
  tempText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#263238',
  },
  hourlyDetails: {
    marginTop: 10,
    paddingTop: 10,
    paddingLeft: 15,
    borderTopWidth: 2,
    borderTopColor: '#afb8bc',
    width: '100%',
  },
  hour: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 2,
    borderBottomColor: '#cccfd1',
    gap: 0,
  },
  hourPrimary: {
    width: '40%',
    paddingTop: 5,
    paddingRight: 10,
  },
  hourSecondary: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  hourTime: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#546e7a',
  },
  hourTemp: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#37474f',
  },
  hourDescription: {
    fontSize: 15,
    color: '#546e7a',
    flex: 1,
  },
  iconSmall: {
    width: 40,
    height: 40,
    marginRight: 10,
    resizeMode: 'contain',
  },
  hourlyDetailItem: {
    alignItems: 'flex-start',
    width: '48%',
    paddingVertical: 4,
  },
  hourlyDetailTitle: {
    fontSize: 13,
    color: '#78909c',
  },
  hourlyDetailValue: {
    fontWeight: 'bold',
    color: '#37474f',
    fontSize: 15,
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
    maxWidth: 300,
  },
  suggestionItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  }
})

export default App;
