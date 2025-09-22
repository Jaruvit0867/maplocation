// App.tsx
// React Native Maps – Places Saver (ใช้ react-native-geolocation-service)

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  PermissionsAndroid,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from 'react-native-geolocation-service';

const SCREEN = {
  MAP: 'MAP',
  LIST: 'LIST',
};

export default function App() {
  const [screen, setScreen] = useState(SCREEN.MAP);
  const [region, setRegion] = useState({
    latitude: 13.7563,
    longitude: 100.5018,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [current, setCurrent] = useState(null);
  const [places, setPlaces] = useState([]);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const mapRef = useRef(null);

  const STORAGE_KEY = '@places_v1';

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setPlaces(JSON.parse(raw));
      } catch (e) {
        console.warn('Failed to load saved places', e);
      }
    })();
  }, []);

  const persistPlaces = useCallback(async (next) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to save places', e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('ต้องการสิทธิ์ตำแหน่ง', 'กรุณาอนุญาตการเข้าถึงตำแหน่ง');
          return;
        }
      }
      locateMe();
    })();
  }, []);

  const locateMe = useCallback(() => {
    Geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCurrent({ latitude, longitude });
        const nextRegion = { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
        setRegion(nextRegion);
        if (mapRef.current) {
          mapRef.current.animateToRegion(nextRegion, 600);
        }
      },
      (error) => {
        Alert.alert('ไม่พบตำแหน่ง', error.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  }, []);

  const openSaveModal = useCallback(async () => {
    if (!current) {
      await locateMe();
    }
    setForm({ name: '', description: '' });
    setSaveModalVisible(true);
  }, [current, locateMe]);

  const savePlace = useCallback(() => {
    if (!current) {
      Alert.alert('ยังไม่ทราบตำแหน่ง', 'กรุณากด "หาตำแหน่งฉัน" ก่อน');
      return;
    }
    if (!form.name.trim()) {
      Alert.alert('กรอกชื่อสถานที่', 'โปรดระบุชื่อสถานที่');
      return;
    }
    const id = Date.now().toString();
    const item = {
      id,
      name: form.name.trim(),
      description: form.description.trim(),
      coordinate: { ...current },
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...places];
    setPlaces(next);
    persistPlaces(next);
    setSaveModalVisible(false);
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        { ...region, ...current, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        600,
      );
    }
    setScreen(SCREEN.MAP);
  }, [current, form, places, persistPlaces, region]);

  const focusPlace = useCallback((p) => {
    setScreen(SCREEN.MAP);
    const nextRegion = {
      latitude: p.coordinate.latitude,
      longitude: p.coordinate.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setRegion(nextRegion);
    requestAnimationFrame(() => {
      if (mapRef.current) {
        mapRef.current.animateToRegion(nextRegion, 600);
      }
    });
  }, []);

  const deletePlace = useCallback(
    (id) => {
      Alert.alert('ลบสถานที่', 'ยืนยันการลบ?', [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: () => {
            const next = places.filter((p) => p.id !== id);
            setPlaces(next);
            persistPlaces(next);
          },
        },
      ]);
    },
    [places, persistPlaces],
  );

  const renderFAB = useMemo(
    () => (
      <View pointerEvents="box-none" style={styles.fabContainer}>
        <TouchableOpacity style={[styles.fab, styles.fabPrimary]} onPress={locateMe}>
          <Text style={styles.fabText}>หาตำแหน่งฉัน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, styles.fabSuccess]} onPress={openSaveModal}>
          <Text style={styles.fabText}>บันทึกสถานที่</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fab, styles.fabSecondary]}
          onPress={() => setScreen(SCREEN.LIST)}>
          <Text style={styles.fabText}>รายการที่บันทึก</Text>
        </TouchableOpacity>
      </View>
    ),
    [locateMe, openSaveModal],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'} />
      {screen === SCREEN.MAP ? (
        <View style={styles.container}>
          <Header
            title="แผนที่ & สถานที่ของฉัน"
            onRight={() => setScreen(SCREEN.LIST)}
            rightLabel="รายการ"
          />
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={region}
            region={region}
            onRegionChangeComplete={(r) => setRegion(r)}
            showsUserLocation
            followsUserLocation={false}
            showsMyLocationButton={false}>
            {places.map((p) => (
              <Marker key={p.id} coordinate={p.coordinate} title={p.name} description={p.description}>
                <Callout onPress={() => focusPlace(p)}>
                  <View style={{ maxWidth: 220 }}>
                    <Text style={{ fontWeight: '700', marginBottom: 4 }}>{p.name}</Text>
                    {!!p.description && <Text style={{ marginBottom: 6 }}>{p.description}</Text>}
                    <Text style={{ opacity: 0.6, fontSize: 12 }}>
                      {p.coordinate.latitude.toFixed(6)}, {p.coordinate.longitude.toFixed(6)}
                    </Text>
                    <Text style={{ color: '#1f6feb', marginTop: 8 }}>ดู/โฟกัสตำแหน่งนี้</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
          {renderFAB}

          {/* Bottom Sheet Save Form */}
          {saveModalVisible && (
            <View style={styles.bottomSheet}>
              <Text style={styles.modalTitle}>บันทึกสถานที่</Text>
              <TextInput
                placeholder="ชื่อสถานที่"
                style={styles.input}
                value={form.name}
                onChangeText={(t) => setForm((s) => ({ ...s, name: t }))}
              />
              <TextInput
                placeholder="คำบรรยาย (ไม่บังคับ)"
                style={[styles.input, { height: 90 }]}
                multiline
                value={form.description}
                onChangeText={(t) => setForm((s) => ({ ...s, description: t }))}
              />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <Pressable
                  onPress={() => setSaveModalVisible(false)}
                  style={[styles.btn, styles.btnGhost]}>
                  <Text style={[styles.btnText, { color: '#111' }]}>ยกเลิก</Text>
                </Pressable>
                <Pressable onPress={savePlace} style={[styles.btn, styles.btnPrimary]}>
                  <Text style={styles.btnText}>บันทึก</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      ) : (
        <SavedListScreen
          places={places}
          onBack={() => setScreen(SCREEN.MAP)}
          onSelect={focusPlace}
          onDelete={deletePlace}
        />
      )}
    </SafeAreaView>
  );
}

function Header({ title, onRight, rightLabel }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
      <TouchableOpacity onPress={onRight}>
        <Text style={styles.headerAction}>{rightLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function SavedListScreen({ places, onBack, onSelect, onDelete }) {
  return (
    <View style={styles.container}>
      {/* Header พร้อมปุ่มกลับทางซ้าย */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>⬅ กลับ</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>รายการสถานที่ที่บันทึก</Text>
        <View style={{ width: 60 }} /> {/* spacer ให้ title อยู่กลาง */}
      </View>

      {places.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, opacity: 0.7 }}>ยังไม่มีการบันทึกสถานที่</Text>
          <Text style={{ fontSize: 13, opacity: 0.6, marginTop: 6 }}>
            กดปุ่ม "บันทึกสถานที่" ที่หน้าแผนที่เพื่อเพิ่มรายการ
          </Text>
        </View>
      ) : (
        <FlatList
          data={places}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable onPress={() => onSelect(item)} style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 16 }} numberOfLines={1}>
                  {item.name}
                </Text>
                {!!item.description && (
                  <Text style={{ marginTop: 4 }} numberOfLines={2}>{item.description}</Text>
                )}
                <Text style={{ marginTop: 6, opacity: 0.6, fontSize: 12 }}>
                  {item.coordinate.latitude.toFixed(6)}, {item.coordinate.longitude.toFixed(6)}
                </Text>
                <Text style={{ marginTop: 2, opacity: 0.6, fontSize: 12 }}>
                  บันทึกเมื่อ: {new Date(item.createdAt).toLocaleString()}
                </Text>
              </Pressable>
              <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteBtn}>
                <Text style={{ color: 'white', fontWeight: '700' }}>ลบ</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  header: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', flex: 1 },
  headerAction: { color: '#1f6feb', fontWeight: '700' },
  fabContainer: { position: 'absolute', right: 12, bottom: 12, gap: 10 },
  fab: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, elevation: 2 },
  fabPrimary: { backgroundColor: '#1f6feb' },
  fabSecondary: { backgroundColor: '#7c3aed' },
  fabSuccess: { backgroundColor: '#059669' },
  fabText: { color: 'white', fontWeight: '700' },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    elevation: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, marginBottom: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: '#1f6feb' },
  btnGhost: { backgroundColor: '#f3f4f6' },
  btnText: { color: 'white', fontWeight: '700' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#ef4444' },
  backBtn: { padding: 8, borderRadius: 8 },
  backText: { fontSize: 18, color: '#1f6feb', fontWeight: '700' },
  backBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backText: {
    fontSize: 16,
    color: '#1f6feb',
    fontWeight: '700',
  },
});
