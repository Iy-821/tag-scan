import ellipse161 from "./ellipse-161.svg";
import { FlashlightOn } from "./FlashlightOn";
import icon from "./icon.svg";
import { Photo } from "./Photo";
import { Size48 } from "./Size48";
import { Square } from "./Square";
import statusBar from "./status-bar.svg";
import { Text } from "./Text";
import { TextHeading } from "./TextHeading";
import "./style.css";

export const StockCamera = () => {
  return (
    <div className="stock-camera">
      <img className="status-bar" alt="Status bar" src={statusBar} />
      <div className="home-indicator" />
      <Text
        className="text-instance"
        divClassName="design-component-instance-node"
        text="枠内にスキャンしたいタグを収めてください。"
      />
      <div className="frame">
        <div className="frame-2">
          <Size48 className="circle" color="white" />
          <Text
            className="text-2"
            divClassName="design-component-instance-node"
            text="Album"
          />
          <Photo className="photo-instance" color="white" />
        </div>
        <div className="frame-2">
          <div className="frame-3">
            <Size48 className="size-48" color="white" />
            <FlashlightOn className="flashlight-on" color="white" />
          </div>
          <Text
            className="text-2"
            divClassName="design-component-instance-node"
            text="Light"
          />
        </div>
      </div>
      <div className="frame-4">
        <div className="maximize">
          <img className="icon" alt="Icon" src={icon} />
        </div>
        <Square className="square-instance" />
      </div>
      <TextHeading
        className="text-heading-instance"
        divClassName="design-component-instance-node"
        text="タグ読みくん"
      />
      <div className="frame-5">
        <img className="ellipse" alt="Ellipse" src={ellipse161} />
        <Size48 className="size-48-instance" color="#FFFDFD" />
      </div>
    </div>
  );
};
