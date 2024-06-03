// import { AppStore } from '../store';
import './global.css';
import Head from 'next/head';
// bootstrap css
import 'bootstrap/dist/css/bootstrap.min.css';

export default function MyApp({
  Component,
  pageProps,
}) {
  // connect to Redux store if needed
  // Component = (
  //   <AppStore>
  //     <Component />
  //   </AppStore>
  // );
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}