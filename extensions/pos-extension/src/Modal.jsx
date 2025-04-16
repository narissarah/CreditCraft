import { 
  Screen, 
  Navigator, 
  reactExtension, 
  useScannerDataSubscription, 
  CameraScanner, 
  useApi, 
  Text,
  BlockStack,
  Button,
  TextBlock,
  Heading,
  View
} from '@shopify/ui-extensions-react/point-of-sale';

/**
 * Modal component for scanning customer loyalty QR codes
 * Allows staff to quickly identify customers and apply stored credit
 */
function Modal() {
  const { cart, toast, navigation } = useApi();
  const { data, source } = useScannerDataSubscription();
  
  // This runs on every change to `data`.
  if (data?.startsWith('gid://shopify/Customer/')) {
    const id = parseInt(data.split("/").pop());
    cart.setCustomer({ id: id });
    toast.show(`Customer found! Credit information loaded.`);
    navigation.pop();
  }

  return (
    <Navigator>
      <Screen title="Scan Customer Credit Card">
        <BlockStack spacing="tight" inlineAlignment="center">
          <Heading>Scan Customer QR Code</Heading>
          <TextBlock>Scan the customer's CreditCraft QR code to identify them and load their available credit</TextBlock>
          <View maxInlineSize={300} border="base" cornerRadius="base" padding="base">
            <CameraScanner />
          </View>
          <Button kind="primary" onPress={() => navigation.pop()}>Cancel</Button>
        </BlockStack>
      </Screen>
    </Navigator>
  );
}

export default reactExtension(
  "pos.home.modal.render", 
  () => <Modal />
); 