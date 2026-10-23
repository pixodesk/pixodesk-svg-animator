import { View } from 'react-native';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-rn';
import animation from './animation.json';

export default function App() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 300, height: 300 }}>
        <SvgAnimationPlayer doc={animation} playAsSaved />
      </View>
    </View>
  );
}
