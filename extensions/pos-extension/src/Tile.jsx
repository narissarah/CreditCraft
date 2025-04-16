import { 
  Tile, 
  reactExtension, 
  useApi 
} from '@shopify/ui-extensions-react/point-of-sale';

/**
 * Tile component that appears on the POS home screen
 * Opens the QR scanner modal when clicked
 */
function TileComponent() {
  const { action } = useApi();
  
  return (
    <Tile
      title="CreditCraft"
      subtitle="Scan customer credit card"
      onPress={() => {
        action.presentModal();
      }}
      enabled
      icon={{
        source: "creditcard"
      }}
    />
  );
}

export default reactExtension(
  "pos.home.tile.render", 
  () => <TileComponent />
); 