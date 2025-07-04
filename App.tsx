import { zipData } from './data/zipData';
import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';

function toTitleCase(str) {
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function App() {
  const [zip, setZip] = useState('');
  const [dailyData, setDailyData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [expandedDate, setExpandedDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = async () => {
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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.appContainer}>
          <Text style={styles.title}>7-Day Weather Forecast</Text>
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              value={zip}
              onChangeText={setZip}
              placeholder="Enter ZIP code"
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.button} onPress={handleSubmit}>
              <Text style={styles.buttonText}>Submit</Text>
            </TouchableOpacity>
          </View>

          {location ? <Text style={styles.locationText}>Weather forecast for {location}</Text> : null}

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
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#e0f2f7',
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: 25,
  },
  appContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
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
    borderTopWidth: 1,
    borderTopColor: '#cfd8dc',
    width: '100%',
  },
  hour: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#eceff1',
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
});

export default App;