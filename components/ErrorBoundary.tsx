import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

type Props = { children: React.ReactNode };
type State = { error: Error | null; info: string };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, info: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info: info.componentStack || '' });
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.title}>Erreur détectée</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <Text style={styles.stack}>{this.state.error.stack}</Text>
          <Text style={styles.stack}>{this.state.info}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: 'bold', color: 'red', marginBottom: 10 },
  message: { fontSize: 14, color: '#000', marginBottom: 10 },
  stack: { fontSize: 10, color: '#555', marginBottom: 20 },
});
