import { italiana } from "./fonts";
import styles from "./app.module.css";

export default function Landing() {
    return (<div
        className={italiana.className + ' ' + styles["grainy-background"]}
        style={{
            color: 'rgb(255, 255, 255)',
            textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
            fontSize: 30,
            letterSpacing: 11,
            width: '100vw',
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
        }
        }>
        {"Laurus"}
    </div>)
}